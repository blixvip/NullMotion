import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceText = await readFile(new URL('../public/demo.mjs', import.meta.url), 'utf8');
const htmlText = await readFile(new URL('../public/demo.html', import.meta.url), 'utf8');

test('exportPreview takes a start and end and exposes a current-section menu item', () => {
  assert.match(sourceText, /async function exportPreview\(start = 0, end = Infinity/, 'exportPreview should accept start and end');
  assert.match(htmlText, /id="download-section"/, 'demo.html should offer a Current section export');
  assert.match(sourceText, /\$\('download-section'\)\.addEventListener/, 'the Current section item should export its section');
});

// Run the real encodeAudio from demo.mjs against stub encoder classes, so the trim and
// timestamps are checked by behavior rather than by matching source text.
function encodeAudioFromSource() {
  const text = sourceText.replace(/\r\n/g, '\n');
  const from = text.indexOf('async function encodeAudio');
  assert.notEqual(from, -1, 'demo.mjs should define encodeAudio');
  const body = text.slice(from, text.indexOf('\n}\n', from) + 2);
  class AudioData { constructor(init) { this.timestamp = init.timestamp; this.data = init.data; } close() {} }
  class AudioEncoder {
    constructor(init) { this.output = init.output; this.chunks = []; }
    configure() {}
    encode(chunk) { this.output({ timestamp: chunk.timestamp, first: chunk.data[0] }, {}); }
    async flush() {}
    close() {}
  }
  return new Function('AudioEncoder', 'AudioData', `${body}\nreturn encodeAudio;`)(AudioEncoder, AudioData);
}

test('encodeAudio trims the copied audio to [start, end) and timestamps it from 0', async () => {
  const encodeAudio = encodeAudioFromSource();
  // 10 seconds at 10 Hz, one sample per index, so a sample's value shows where it came from.
  const buffer = {
    numberOfChannels: 1, sampleRate: 10, length: 100,
    getChannelData: () => Float32Array.from({ length: 100 }, (_, i) => i),
  };
  const chunks = [];
  const muxer = { addAudioChunk: chunk => chunks.push(chunk) };
  await encodeAudio(buffer, muxer, 2, 4);
  assert.deepEqual(chunks.map(chunk => chunk.timestamp), [0, 1e6], 'audio timestamps should start at 0 for the trimmed range');
  assert.deepEqual(chunks.map(chunk => chunk.first), [20, 30], 'audio should start at the range start (2 s) and stop at its end (4 s)');
});
