import test from 'node:test';
import assert from 'node:assert/strict';

// demo.mjs touches the DOM at import time, so the two decision functions are
// exercised through a DOM shim rather than by running the module. A regex over
// the source would pass on a guard that is present but wrong, which is exactly
// the bug this covers: the guard existed and returned early for every button.
const TEXT_INPUTS = new Set([
  '', 'text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date',
  'datetime-local', 'month', 'time', 'week',
]);

// Minimal stand-ins for the parts of Element the guard reads.
function element({ tagName, id = '', classes = [], type, contentEditable, contenteditable, parent }) {
  const node = {
    tagName,
    id,
    ...(type === undefined ? {} : { type }),
    getAttribute: name => (name === 'type' ? (type ?? null) : null),
    hasAttribute: name => (name === 'contenteditable' ? Boolean(contenteditable) : false),
    parent,
  };
  if (contentEditable !== undefined) node.isContentEditable = contentEditable;
  node.classList = { contains: name => classes.includes(name) };
  // closest() walks from the node itself, like Element.closest.
  node.closest = selector => {
    const parts = selector.split(',').map(part => part.trim());
    for (const current of ancestors(node)) {
      if (parts.some(part => matches(current, part))) return current;
    }
    return null;
  };
  return node;
}

function* ancestors(node) {
  for (let current = node; current; current = current.parent) yield current;
}

function matches(node, selector) {
  switch (selector) {
    case 'button': return node.tagName === 'BUTTON';
    case 'a': return node.tagName === 'A';
    case 'input': return node.tagName === 'INPUT';
    case 'textarea': return node.tagName === 'TEXTAREA';
    case 'select': return node.tagName === 'SELECT';
    case '[contenteditable]': return Boolean(node.contenteditable) || node.isContentEditable === true;
    default: return false;
  }
}

const target = node => node;

const { isTextEntry, spaceHandledNatively } = await loadDecisions();

// The real module cannot be imported without a DOM, so pull the two exported
// functions out of the source and evaluate them in isolation. Any change to
// their bodies is picked up here rather than silently ignored.
async function loadDecisions() {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../public/demo.mjs', import.meta.url), 'utf8');
  const bodies = [];
  for (const name of ['isTextEntry', 'spaceHandledNatively']) {
    const start = source.indexOf(`export function ${name}(`);
    assert.ok(start > 0, `${name} must be exported so it can be tested`);
    const open = source.indexOf('{', start);
    let depth = 0, end = open;
    for (let i = open; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}' && --depth === 0) { end = i; break; }
    }
    bodies.push(source.slice(start, end + 1).replace(/^export /, ''));
  }
  const factory = new Function(`${bodies.join('\n')}; return { isTextEntry, spaceHandledNatively };`);
  return factory();
}

test('a focused pause button no longer swallows the frame-step shortcuts', () => {
  // The reported bug: click pause, then press "." — the button stayed focused
  // and the old guard returned before any shortcut ran.
  assert.equal(isTextEntry(target(element({ tagName: 'BUTTON', id: 'final-toggle' }))), false);
});

test('a library card (a button) no longer blocks the arrow keys', () => {
  assert.equal(isTextEntry(target(element({ tagName: 'BUTTON', classes: ['card'] }))), false);
});

test('a link does not block the shortcuts', () => {
  assert.equal(isTextEntry(target(element({ tagName: 'A' }))), false);
});

test('text entry still gets its keys back', () => {
  for (const type of TEXT_INPUTS) {
    assert.equal(isTextEntry(target(element({ tagName: 'INPUT', type: type || null }))), true, `input[type=${type || 'text'}] must keep the keys`);
  }
  assert.equal(isTextEntry(target(element({ tagName: 'TEXTAREA' }))), true);
  assert.equal(isTextEntry(target(element({ tagName: 'SELECT' }))), true);
});

test('non-text inputs must not swallow the shortcuts', () => {
  for (const type of ['checkbox', 'radio', 'range', 'file', 'button', 'submit', 'reset', 'color', 'hidden']) {
    assert.equal(isTextEntry(target(element({ tagName: 'INPUT', type }))), false, `input[type=${type}] must let the shortcuts through`);
  }
});

test('contenteditable keeps the keys, and so does a child of it', () => {
  const editable = element({ tagName: 'DIV', isContentEditable: true, contenteditable: '' });
  editable.isContentEditable = true;
  assert.equal(isTextEntry(target(editable)), true);
  const child = element({ tagName: 'SPAN', parent: editable });
  assert.equal(isTextEntry(target(child)), true, 'a caret inside contenteditable is still text entry');
});

test('a non-editable div does not block the shortcuts', () => {
  assert.equal(isTextEntry(target(element({ tagName: 'DIV', isContentEditable: false }))), false);
});

test('an unknown target is not treated as text entry', () => {
  assert.equal(isTextEntry(null), false);
  assert.equal(isTextEntry({}), false);
});

test('Space is left to native activation on a button or link, and handled here otherwise', () => {
  // Double-firing is the failure mode: the handler calling .click() on top of
  // the browser's own activation toggles playback twice.
  assert.equal(spaceHandledNatively(target(element({ tagName: 'BUTTON' }))), true);
  assert.equal(spaceHandledNatively(target(element({ tagName: 'A' }))), true);
  assert.equal(spaceHandledNatively(target(element({ tagName: 'DIV' }))), false);
  assert.equal(spaceHandledNatively(target(element({ tagName: 'VIDEO' }))), false);
  assert.equal(spaceHandledNatively(null), false);
});
