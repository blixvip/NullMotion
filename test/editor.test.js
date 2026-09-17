import test from 'node:test';
import assert from 'node:assert/strict';
import { splitReference, locateClip, moveClip, sequenceDuration } from '../public/editor-model.mjs';

test('reference segments cover the source with no gaps or tiny tails', () => {
  const clips = splitReference({ id: 'sample', duration: 12.1 }, 4);
  assert.equal(clips[0].in, 0);
  assert.equal(clips.at(-1).out, 12.1);
  assert.ok(clips.every(clip => clip.out - clip.in >= 0.25));
  clips.slice(1).forEach((clip, i) => assert.equal(clip.in, clips[i].out));
  assert.deepEqual(splitReference({ id: 'bad', duration: 0 }), []);
});
test('sequence seeking maps to the correct source moment at boundaries', () => {
  const clips = [{ in: 2, out: 5 }, { in: 10, out: 14 }];
  assert.equal(sequenceDuration(clips), 7);
  assert.deepEqual(locateClip(clips, 3), { index: 1, local: 10 });
  assert.deepEqual(locateClip(clips, 100), { index: 1, local: 14 });
  assert.deepEqual(locateClip(clips, -4), { index: 0, local: 2 });
  assert.equal(locateClip([], 0), null);
});
test('reordering preserves every clip and leaves the original unchanged', () => {
  const clips = ['a', 'b', 'c'];
  assert.deepEqual(moveClip(clips, 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(clips, ['a', 'b', 'c']);
  assert.deepEqual(moveClip(clips, -1, 2), clips);
});
