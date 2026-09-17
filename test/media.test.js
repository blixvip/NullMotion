import test from 'node:test';
import assert from 'node:assert/strict';
import { byteRange } from '../media.js';
test('video byte ranges support seeking without loading whole sources', () => {
  assert.deepEqual(byteRange('bytes=3-7', 10), { start: 3, end: 7 });
  assert.deepEqual(byteRange('bytes=7-', 10), { start: 7, end: 9 });
  assert.deepEqual(byteRange('bytes=-3', 10), { start: 7, end: 9 });
  assert.deepEqual(byteRange('bytes=0-999', 10), { start: 0, end: 9 });
  for (const value of ['bytes=10-', 'bytes=7-2', 'bytes=-0', 'bytes=a-b', 'bytes=0-2,4-6']) assert.equal(byteRange(value, 10), null);
});
