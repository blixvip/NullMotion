import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/demo.mjs', import.meta.url), 'utf8');

function runDemo({ stored = null, storageThrows = false, playRejects = false } = {}) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      id, dataset: {}, style: { setProperty() {} }, classList: { toggle() {} },
      addEventListener(name, callback) { this.listeners ||= {}; this.listeners[name] = callback; },
      setAttribute() {}, replaceChildren() {}, append() {}, querySelector() { return element('child'); },
      getBoundingClientRect() { return { left: 0, right: 0, top: 0, bottom: 0, width: 1, height: 1 }; }
    });
    return elements.get(id);
  };
  const video = Object.assign(element('final-video'), {
    muted: true, paused: true, currentTime: 0,
    play() { return playRejects ? Promise.reject(new Error('autoplay blocked')) : Promise.resolve(); },
    pause() {}
  });
  const writes = [];
  const document = {
    getElementById: element,
    querySelector() { return element('query'); },
    querySelectorAll() { return []; },
    createElement(tag) { return element(tag); },
    addEventListener() {}, body: { append() {} }
  };
  const context = {
    document, window: {}, video, performance: { now: () => 0 }, matchMedia: () => ({ matches: true }),
    localStorage: {
      getItem() { if (storageThrows) throw new Error('storage blocked'); return stored; },
      setItem(key, value) { if (storageThrows) throw new Error('storage blocked'); writes.push([key, value]); }
    },
    fetch: async () => ({ ok: true, json: async () => ({ references: [] }) }),
    ResizeObserver: class { observe() {} }, URLSearchParams, location: { search: '' },
    history: { replaceState() {} }, requestAnimationFrame() {}, setTimeout() {}, console
  };
  const executable = source.replace(/^\uFEFF/, '').replace(/^import .*;\r?\n/gm, '');
  vm.runInNewContext(executable, context, { filename: 'public/demo.mjs' });
  return { video, button: element('sound'), writes };
}

test('demo module restores and saves sound preference and handles storage and autoplay failures', async () => {
  const restored = runDemo({ stored: 'on' });
  assert.equal(restored.video.muted, false, 'saved sound-on preference is restored');
  assert.equal(restored.button.textContent, 'Sound on');

  const unavailableStorage = runDemo({ storageThrows: true });
  unavailableStorage.button.listeners.click();
  assert.equal(unavailableStorage.video.muted, false, 'sound toggle still works when storage throws');
  assert.deepEqual(unavailableStorage.writes, []);

  const blockedPlayback = runDemo({ playRejects: true });
  blockedPlayback.button.listeners.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(blockedPlayback.video.muted, true, 'rejected audible playback falls back to muted');
  assert.deepEqual(blockedPlayback.writes, [['sound', 'on']], 'fallback preserves the saved audible choice');
  assert.equal(blockedPlayback.button.textContent, 'Sound off');
});
