import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Parses the shell's source for the keyboard contract of the AI tools dock.
test('AI dock keyboard contract is wired in site-shell', async () => {
  const source = await readFile(new URL('../public/site-shell.js', import.meta.url), 'utf8');

  assert.ok(/id="nullAiTab-\$\{key\}"/.test(source), 'AI dock keyboard: each tab needs an id');
  assert.ok(/aria-controls="nullAiFrame-\$\{key\}"/.test(source), 'AI dock keyboard: each tab needs aria-controls pointing at its iframe');
  assert.ok(/id="nullAiFrame-\$\{key\}"[^>]*role="tabpanel"/.test(source), 'AI dock keyboard: each iframe needs an id and role="tabpanel"');
  assert.ok(/tab\.tabIndex = selected \? 0 : -1/.test(source), 'AI dock keyboard: tabs need a roving tabindex in selectTool');
  assert.ok(/\["ArrowLeft", "ArrowRight", "Home", "End"\]/.test(source), 'AI dock keyboard: tablist needs Left/Right/Home/End handling');
  assert.ok(/addEventListener\("keydown", event => \{[^}]*event\.defaultPrevented/s.test(source), 'AI dock keyboard: Escape handler must ignore events the page already handled');
  assert.ok(/dock\.contains\(document\.activeElement\)/.test(source), 'AI dock keyboard: Escape and close must only act when focus is inside the dock');
  const restore = source.indexOf('toggle.focus(');
  const inert = source.indexOf('dock.inert = !dockOpen');
  assert.ok(restore > 0 && inert > restore, 'AI dock keyboard: focus must move to the toggle before the dock becomes inert');
});
