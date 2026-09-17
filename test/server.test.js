import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.js';

test('public workspace is standalone, read-only, and serves its own previews', async t => {
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = path => fetch(base + path);

  const home = await get('/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Null.*Launch Studio/);
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
});
