import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { byteRange, extractAudio, streamVideo } from '../media.js';

test('byte ranges parse closed, open-ended, and suffix requests', () => {
  const cases = [
    ['bytes=0-0', 10, { start: 0, end: 0 }],
    ['bytes=3-7', 10, { start: 3, end: 7 }],
    ['bytes=7-', 10, { start: 7, end: 9 }],
    ['bytes=-3', 10, { start: 7, end: 9 }],
    ['bytes=-10', 10, { start: 0, end: 9 }],
    ['bytes=-20', 10, { start: 0, end: 9 }],
    ['bytes=0-999', 10, { start: 0, end: 9 }],
    ['bytes=9-9', 10, { start: 9, end: 9 }],
    ['bytes=0-', 1, { start: 0, end: 0 }],
    ['bytes=-1', 1, { start: 0, end: 0 }]
  ];

  for (const [value, size, expected] of cases) {
    assert.deepEqual(byteRange(value, size), expected, value);
  }
});

test('byte ranges reject malformed, multiple, reversed, and unsatisfiable requests', () => {
  const invalid = [
    '',
    'items=0-1',
    'bytes=',
    'bytes=-',
    'bytes=a-b',
    'bytes=1-a',
    'bytes=a-1',
    'bytes=7-2',
    'bytes=10-',
    'bytes=-0',
    'bytes=0-1,3-4',
    'bytes= 0-1',
    'bytes=0-1 ',
    'bytes=+1-2',
    'bytes=1.5-2',
    'bytes=9007199254740992-'
  ];

  for (const value of invalid) {
    assert.equal(byteRange(value, 10), null, JSON.stringify(value));
  }

  assert.equal(byteRange('bytes=0-0', 0), null);
  assert.equal(byteRange('bytes=-1', 0), null);
});

test('streamVideo serves complete files, partial ranges, HEAD, and errors', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'nullmotion-media-'));
  const filename = path.join(directory, 'sample.mp4');
  const emptyFilename = path.join(directory, 'empty.mp4');
  const contents = Buffer.from('0123456789');
  await writeFile(filename, contents);
  await writeFile(emptyFilename, Buffer.alloc(0));

  const server = createServer((request, response) => {
    const target = request.url === '/missing' ? path.join(directory, 'missing.mp4') : request.url === '/empty' ? emptyFilename : filename;
    void streamVideo(request, response, target, 'video/mp4');
  }).listen(0, '127.0.0.1');

  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const full = await fetch(base + '/video');
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('content-type'), 'video/mp4');
  assert.equal(full.headers.get('accept-ranges'), 'bytes');
  assert.equal(full.headers.get('content-length'), String(contents.length));
  assert.equal(full.headers.get('cache-control'), 'private, max-age=3600');
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), contents);

  const empty = await fetch(base + '/empty');
  assert.equal(empty.status, 200);
  assert.equal(empty.headers.get('content-length'), '0');
  assert.equal(await empty.text(), '');

  const emptyHead = await fetch(base + '/empty', { method: 'HEAD' });
  assert.equal(emptyHead.status, 200);
  assert.equal(emptyHead.headers.get('content-length'), '0');
  assert.equal(await emptyHead.text(), '');

  const emptyRange = await fetch(base + '/empty', { headers: { Range: 'bytes=0-' } });
  assert.equal(emptyRange.status, 416);
  assert.equal(emptyRange.headers.get('content-range'), 'bytes */0');
  assert.equal(await emptyRange.text(), '');

  const ranges = [
    ['bytes=0-2', 'bytes 0-2/10', '012'],
    ['bytes=4-', 'bytes 4-9/10', '456789'],
    ['bytes=-3', 'bytes 7-9/10', '789'],
    ['bytes=7-999', 'bytes 7-9/10', '789'],
    ['bytes=9-9', 'bytes 9-9/10', '9']
  ];

  for (const [value, contentRange, body] of ranges) {
    const response = await fetch(base + '/video', { headers: { Range: value } });
    assert.equal(response.status, 206, value);
    assert.equal(response.headers.get('content-range'), contentRange, value);
    assert.equal(response.headers.get('content-length'), String(body.length), value);
    assert.equal(response.headers.get('accept-ranges'), 'bytes', value);
    assert.equal(await response.text(), body, value);
  }

  const head = await fetch(base + '/video', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-length'), String(contents.length));
  assert.equal(head.headers.get('accept-ranges'), 'bytes');
  assert.equal(await head.text(), '');

  const rangedHead = await fetch(base + '/video', { method: 'HEAD', headers: { Range: 'bytes=2-4' } });
  assert.equal(rangedHead.status, 206);
  assert.equal(rangedHead.headers.get('content-range'), 'bytes 2-4/10');
  assert.equal(rangedHead.headers.get('content-length'), '3');
  assert.equal(await rangedHead.text(), '');

  for (const value of ['bytes=10-', 'bytes=7-2', 'bytes=-0', 'bytes=0-1,3-4', 'invalid']) {
    const response = await fetch(base + '/video', { headers: { Range: value } });
    assert.equal(response.status, 416, value);
    assert.equal(response.headers.get('content-range'), 'bytes */10', value);
    assert.equal(await response.text(), '');
  }

  const missing = await fetch(base + '/missing');
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), 'Reference unavailable.');
});


test('extractAudio reuses cached files and shares concurrent extraction', async t => {
  if (process.platform === 'win32') return t.skip('Uses a temporary POSIX ffmpeg executable');

  const directory = await mkdtemp(path.join(os.tmpdir(), 'nullmotion-ffmpeg-'));
  const bin = path.join(directory, 'bin');
  await mkdir(bin);
  const executable = path.join(bin, 'ffmpeg');
  const video = path.join(directory, 'source.mp4');
  const audio = path.join(directory, 'result.aac');
  const count = path.join(directory, 'invocations');
  const originalPath = process.env.PATH;

  t.after(async () => {
    process.env.PATH = originalPath;
    await rm(directory, { recursive: true, force: true });
  });

  await writeFile(executable, `#!/bin/sh
for argument do output="$argument"; done
printf '1' >> "${count}"
printf 'aac-data' > "$output"
`);
  await chmod(executable, 0o755);
  process.env.PATH = bin;

  const first = extractAudio(video, audio);
  const concurrent = extractAudio(video, audio);
  assert.equal(first, concurrent);
  assert.equal(await first, true);
  assert.equal(await readFile(audio, 'utf8'), 'aac-data');
  assert.equal((await readFile(count, 'utf8')), '1');
  assert.equal(await extractAudio(video, audio), true);

  const failedAudio = path.join(directory, 'failed.aac');
  await writeFile(executable, `#!/bin/sh
for argument do output="$argument"; done
printf 'partial' > "$output"
exit 1
`);
  assert.equal(await extractAudio(video, failedAudio), false);
  await assert.rejects(stat(failedAudio + '.part'), { code: 'ENOENT' });

  process.env.PATH = path.join(directory, 'missing-bin');
  const spawnErrorAudio = path.join(directory, 'spawn-error.aac');
  assert.equal(await extractAudio(video, spawnErrorAudio), false);
  await assert.rejects(stat(spawnErrorAudio + '.part'), { code: 'ENOENT' });
});
