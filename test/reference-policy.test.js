import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { curateReferences } from '../public/reference-policy.mjs';
const policy = JSON.parse(await readFile(new URL('../data/reference-policy.json', import.meta.url), 'utf8'));
test('curation removes live-action footage while preserving motion references', () => {
  const references = [{ id: 'nexa-references-2095595661559574528', segments: [{ in: 0, out: 4 }] }, { id: '919ebec37a3b', name: 'Troovy' }, { id: '69614b10fa87', name: 'Old title' }];
  const curated = curateReferences(references, policy);
  assert.equal(curated.length, 2);
  assert.equal(curated[0].name, 'Infinite · Global payments');
  assert.equal(curated[1].name, 'Troovy');
  assert.equal(references.length, 3);
});
