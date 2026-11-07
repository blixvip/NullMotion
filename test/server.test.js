import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.js';

test('public workspace is standalone, read-only, and serves its own previews', async t => {
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = path => fetch(base + path);

  const home = await get('/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Null Motion/);
  assert.match(await (await get('/editor')).text(), /id="clips-track"/);
  assert.match(await (await get('/index.html')).text(), /Template Gallery/);
  const catalog = await (await get('/api/v1/templates')).json();
  assert.ok(catalog.templates.length > 0);
  for (const template of catalog.templates) {
    assert.ok(template.width > 0 && template.height > 0);
    assert.equal((await get('/' + template.preview.path)).status, 200);
    const source = await get(`/api/v1/templates/${template.id}/source`);
    assert.equal(source.status, 200);
    assert.match(source.headers.get('content-type'), /text\/html/);
  }
  assert.deepEqual((await (await get('/api/v1/jobs')).json()).jobs, []);
  const health = await (await get('/health')).json();
  assert.equal(health.mode, 'ui-starter');
  assert.equal(health.capabilities.generation, false);
  for (const path of ['/generate', '/api/v1/pair', '/api/v1/templates']) {
    const response = await fetch(base + path, { method: 'POST', body: '{}' });
    assert.equal(response.status, 501);
    assert.match((await response.json()).error, /not connected/i);
  }
  for (const path of ['/.git/config', '/server.js', '/package.json', '/%2e%2e%5cserver.js', '/assets/%2e%2e%5c%2e%2e%5cserver.js']) {
    assert.ok([400, 403, 404].includes((await get(path)).status), path);
  }
  assert.equal((await get('/%ZZ')).status, 400);
  assert.equal((await get('/api/v1/unknown')).status, 501);
  const references = await (await get('/api/references')).json();
  assert.ok(!references.references.some(reference => reference.id === 'nexa-references-2095595661559574528'));
  assert.equal((await get('/media/references/nexa-references-2095595661559574528.mp4')).status, 404);
});


test('reference media routes stream video ranges, HEAD responses, and audio', async t => {
  const id = '69614b10fa87';
  const video = new URL(`../showcase/media/${id}.mp4`, import.meta.url);
  const audio = new URL(`../showcase/media/${id}.aac`, import.meta.url);
  const [videoSize, audioSize] = await Promise.all([
    stat(video).then(file => file.size),
    stat(audio).then(file => file.size)
  ]);

  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const videoPath = `/media/references/${id}.mp4`;

  const full = await fetch(base + videoPath);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('accept-ranges'), 'bytes');
  assert.equal(Number(full.headers.get('content-length')), videoSize);
  await full.body?.cancel();

  const range = await fetch(base + videoPath, { headers: { Range: 'bytes=0-99' } });
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('content-range'), `bytes 0-99/${videoSize}`);
  assert.equal(Number(range.headers.get('content-length')), 100);
  assert.equal((await range.arrayBuffer()).byteLength, 100);

  const unsatisfiable = await fetch(base + videoPath, { headers: { Range: 'bytes=999999999-' } });
  assert.equal(unsatisfiable.status, 416);
  assert.equal(unsatisfiable.headers.get('content-range'), `bytes */${videoSize}`);
  await unsatisfiable.body?.cancel();

  const head = await fetch(base + videoPath, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('accept-ranges'), 'bytes');
  assert.equal(Number(head.headers.get('content-length')), videoSize);
  assert.equal(await head.text(), '');

  const audioResponse = await fetch(base + `/media/references/${id}.aac`);
  assert.equal(audioResponse.status, 200);
  assert.equal(audioResponse.headers.get('content-type'), 'audio/aac');
  assert.equal(Number(audioResponse.headers.get('content-length')), audioSize);
  await audioResponse.body?.cancel();

  const missing = await fetch(base + '/media/references/nope.mp4');
  assert.equal(missing.status, 404);
  await missing.body?.cancel();
});


test('reference audio routes support HEAD and byte ranges and reject unavailable references', async t => {
  const id = '69614b10fa87';
  const audio = new URL(`../showcase/media/${id}.aac`, import.meta.url);
  const audioSize = (await stat(audio)).size;
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });

  const base = `http://127.0.0.1:${server.address().port}`;
  const audioPath = `/media/references/${id}.aac`;

  const ranged = await fetch(base + audioPath, { headers: { Range: 'bytes=0-15' } });
  assert.equal(ranged.status, 206);
  assert.equal(ranged.headers.get('content-type'), 'audio/aac');
  assert.equal(ranged.headers.get('accept-ranges'), 'bytes');
  assert.equal(ranged.headers.get('content-range'), `bytes 0-15/${audioSize}`);
  assert.equal(ranged.headers.get('content-length'), '16');
  const audioPrefix = Buffer.from(await ranged.arrayBuffer());
  assert.equal(audioPrefix.length, 16);
  assert.equal(audioPrefix[0], 0xff);
  assert.equal(audioPrefix[1] & 0xf6, 0xf0);

  const head = await fetch(base + audioPath, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-type'), 'audio/aac');
  assert.equal(head.headers.get('content-length'), String(audioSize));
  assert.equal(await head.text(), '');

  const invalidRange = await fetch(base + audioPath, { headers: { Range: 'bytes=999999999-' } });
  assert.equal(invalidRange.status, 416);
  assert.equal(invalidRange.headers.get('content-range'), `bytes */${audioSize}`);
  assert.equal(await invalidRange.text(), '');

  const missingAudio = await fetch(base + '/media/references/nope.aac');
  assert.equal(missingAudio.status, 404);
  assert.equal((await missingAudio.json()).error, 'Audio unavailable.');

  const excludedAudio = await fetch(base + '/media/references/nexa-references-2095595661559574528.aac');
  assert.equal(excludedAudio.status, 404);
  assert.equal((await excludedAudio.json()).error, 'Reference removed from this library.');

  const invalidId = await fetch(base + '/media/references/UPPER_CASE.aac');
  assert.equal(invalidId.status, 404);
});


test('reference audio route extracts missing audio once and handles extraction failures', async t => {
  if (process.platform === 'win32') return t.skip('Uses a temporary POSIX ffmpeg executable');

  const mediaDirectory = fileURLToPath(new URL('../.local-media/', import.meta.url));
  const fixtureDirectory = await mkdtemp(path.join(os.tmpdir(), 'nullmotion-route-ffmpeg-'));
  const bin = path.join(fixtureDirectory, 'bin');
  const executable = path.join(bin, 'ffmpeg');
  const count = path.join(fixtureDirectory, 'invocations');
  const originalPath = process.env.PATH;
  const suffix = String(process.pid);
  const successId = `test-extract-success-${suffix}`;
  const failureId = `test-extract-failure-${suffix}`;
  const spawnErrorId = `test-extract-spawn-error-${suffix}`;
  const ids = [successId, failureId, spawnErrorId];

  await mkdir(mediaDirectory, { recursive: true });
  await mkdir(bin);
  for (const id of ids) await writeFile(path.join(mediaDirectory, `${id}.mp4`), 'source-video');

  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    process.env.PATH = originalPath;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await Promise.all(ids.flatMap(id => [
      rm(path.join(mediaDirectory, `${id}.mp4`), { force: true }),
      rm(path.join(mediaDirectory, `${id}.aac`), { force: true }),
      rm(path.join(mediaDirectory, `${id}.aac.part`), { force: true })
    ]));
    await rm(fixtureDirectory, { recursive: true, force: true });
  });

  await writeFile(executable, `#!/bin/sh
for argument do output="$argument"; done
printf 'x' >> "${count}"
printf 'generated-aac' > "$output"
`);
  await chmod(executable, 0o755);
  process.env.PATH = bin;

  const base = `http://127.0.0.1:${server.address().port}`;
  const generated = await fetch(base + `/media/references/${successId}.aac`);
  assert.equal(generated.status, 200);
  assert.equal(generated.headers.get('content-type'), 'audio/aac');
  assert.equal(await generated.text(), 'generated-aac');

  const cached = await fetch(base + `/media/references/${successId}.aac`);
  assert.equal(cached.status, 200);
  assert.equal(await cached.text(), 'generated-aac');
  assert.equal(await readFile(count, 'utf8'), 'x');

  await writeFile(executable, `#!/bin/sh
for argument do output="$argument"; done
printf 'partial' > "$output"
exit 1
`);
  const failed = await fetch(base + `/media/references/${failureId}.aac`);
  assert.equal(failed.status, 404);
  assert.equal((await failed.json()).error, 'Audio unavailable.');
  await assert.rejects(stat(path.join(mediaDirectory, `${failureId}.aac.part`)), { code: 'ENOENT' });

  process.env.PATH = path.join(fixtureDirectory, 'missing-bin');
  const spawnError = await fetch(base + `/media/references/${spawnErrorId}.aac`);
  assert.equal(spawnError.status, 404);
  assert.equal((await spawnError.json()).error, 'Audio unavailable.');
  await assert.rejects(stat(path.join(mediaDirectory, `${spawnErrorId}.aac.part`)), { code: 'ENOENT' });
});
