import test from 'node:test';
import assert from 'node:assert/strict';

// Runs the real page modules against a minimal DOM stub and drives them through their
// own input listeners, so the aria-valuetext written by updatePlayhead() and render() is checked.
const nodes = new Map();
function makeNode(name) {
  const attrs = new Map(), listeners = {};
  const base = {
    name, style: { setProperty() {}, getPropertyValue: () => '' }, dataset: {}, textContent: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute(key, value) { attrs.set(key, String(value)); },
    getAttribute(key) { return attrs.has(key) ? attrs.get(key) : null; },
    removeAttribute(key) { attrs.delete(key); },
    addEventListener(type, handler) { (listeners[type] ||= []).push(handler); },
    removeEventListener() {},
    fire(type) { for (const handler of listeners[type] || []) handler({ target: base, preventDefault() {}, stopPropagation() {} }); },
  };
  return new Proxy(base, {
    get(target, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (prop in target) return target[prop];
      if (prop === 'valueOf') return () => 0;
      if (prop === 'toString') return () => '';
      return () => makeNode(String(prop));
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}
function byId(id) {
  if (!nodes.has(id)) nodes.set(id, makeNode(id));
  return nodes.get(id);
}
globalThis.document = {
  getElementById: byId,
  querySelector: () => makeNode('query'),
  querySelectorAll: () => [],
  createElement: tag => makeNode(tag),
  addEventListener() {}, removeEventListener() {},
  body: makeNode('body'), documentElement: makeNode('html'), activeElement: null,
};
globalThis.window = globalThis;
globalThis.history = { replaceState() {}, pushState() {} };
globalThis.location = { href: 'http://127.0.0.1:4343/', origin: 'http://127.0.0.1:4343', pathname: '/', search: '', hash: '' };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.devicePixelRatio = 1;
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
const savedEditor = { clips: [{ ref: 'ref1', in: 0, out: 150, label: 'Opening' }], brand: '', message: '', aspect: 'landscape', overlay: true };
globalThis.localStorage = { getItem: key => key === 'null-launch-studio-v1' ? JSON.stringify(savedEditor) : null, setItem() {}, removeItem() {} };
const callable = () => new Proxy(function () {}, { get: (t, p) => (typeof p === 'symbol' || p === 'then' ? undefined : p === 'valueOf' ? () => 0 : p === 'toString' ? () => '' : callable()), apply: () => callable() });
globalThis.gsap = callable();
globalThis.fetch = async url => url === '/api/references'
  ? { ok: true, json: async () => ({ references: [{ id: 'ref1', name: 'Reference', duration: 200, segments: [], uploaded: false, src: '/references/ref1.mp4', poster: '/references/ref1.jpg' }] }) }
  : (() => { throw new Error('offline'); })();

test('editor playhead slider sets aria-valuetext from timecode() when the playhead moves', async () => {
  await import('../public/editor.mjs');
  await new Promise(resolve => setTimeout(resolve, 0));
  const scrubber = byId('scrubber');
  scrubber.value = 75.5;
  scrubber.fire('input');
  assert.equal(scrubber.getAttribute('aria-valuetext'), '01:15.50',
    'editor.mjs: #scrubber has no aria-valuetext from timecode() after updatePlayhead()');
});

test('demo seek slider sets aria-valuetext from preciseText() when render() runs', async () => {
  await import('../public/demo.mjs');
  await new Promise(resolve => setTimeout(resolve, 0));
  const seek = byId('seek');
  byId('final-video').currentTime = 75.5;
  seek.value = 75.5;
  seek.fire('input');
  assert.equal(seek.getAttribute('aria-valuetext'), '1:15.5',
    'demo.mjs: #seek has no aria-valuetext from preciseText() after render()');
});
