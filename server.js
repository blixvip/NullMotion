import http from 'node:http';
import { mkdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { streamVideo, extractAudio } from './media.js';
import { curateReferences } from './public/reference-policy.mjs';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const catalog = JSON.parse(await readFile(new URL('./data/template-catalog.json', import.meta.url), 'utf8'));
const referencePolicy = JSON.parse(await readFile(new URL('./data/reference-policy.json', import.meta.url), 'utf8'));
const templates = catalog.templates.map(template => ({
  ...template,
  ...template.output,
  dir: template.id,
  use: template.description,
  tag: template.category,
  qualityStatus: 'needs-review',
  preview: { ...template.preview, path: template.preview.html, playerPath: `${template.preview.html}#play` },
  customizer: template.customizer ? {
    ...template.customizer,
    fields: template.customizer.fields.map(field => ({ ...field, min: field.minimum, max: field.maximum }))
  } : null
}));
const unsupported = { error: 'This feature is not connected in this new project yet.', code: 'NOT_CONNECTED' };
const health = { ok: true, status: 'ok', mode: 'ui-starter', activeJobs: 0, capabilities: { generation: false, rendering: false, premiere: false }, providers: [] };
const readOnly = new Map([
  ['/health', health], ['/api/v1/health', health],
  ['/api/v1/templates', { schemaVersion: 1, templates }],
  ['/api/v1/templates/archived', { templates: [] }],
  ['/jobs', { jobs: [], queue: {} }], ['/api/v1/jobs', { jobs: [], queue: {} }],
  ['/api/themes', { themes: [] }], ['/api/user/active-theme', { theme: null }],
  ['/api/v1/sequence-batches', { batches: [] }],
  ['/api/v1/premiere-presence', { connected: false, sessions: [] }],
  ['/api/v1/premiere-inbox', { items: [] }],
  ['/api/v1/premiere-actions', { actions: [] }]
]);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json; charset=utf-8' };

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': mime['.json'], 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

// Reference media comes from the ignored local library (.local-media/, public/references/)
// when it has been imported, and otherwise from the small committed showcase in showcase/.
const showcase = new URL('./showcase/', import.meta.url);
const exists = async url => { try { await stat(url); return true; } catch { return false; } };
const firstExisting = async (...urls) => { for (const url of urls) if (await exists(url)) return url; return null; };
const localMedia = file => new URL(`./.local-media/${file}`, import.meta.url);

async function serveFile(response, request, directory, pathname) {
  let filename = path.resolve(directory, '.' + pathname);
  try {
    if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
    const [canonicalRoot, canonicalFile] = await Promise.all([realpath(directory), realpath(filename)]);
    const relative = path.relative(canonicalRoot, canonicalFile);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !mime[path.extname(filename)]) {
      return json(response, 403, { error: 'Forbidden.' });
    }
    const data = await readFile(canonicalFile);
    response.writeHead(200, { 'Content-Type': mime[path.extname(filename)], 'Content-Length': data.length });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch (error) {
    json(response, error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500, { error: 'File unavailable.' });
  }
}

export function createApp() {
  return http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { return json(response, 400, { error: 'Invalid URL.' }); }
    if (!['GET', 'HEAD'].includes(request.method)) return json(response, 501, unsupported);
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) {
      return json(response, 403, { error: 'Forbidden.' });
    }
    if (pathname === '/api/references') {
      try {
        const catalog = await firstExisting(new URL('./public/references/catalog.json', import.meta.url), new URL('references/catalog.json', showcase));
        const library = JSON.parse(await readFile(catalog, 'utf8'));
        return json(response, 200, { references: curateReferences(library.references || [], referencePolicy) });
      }
      catch { return json(response, 200, { references: [] }); }
    }
    const audioMatch = pathname.match(/^\/media\/references\/([a-z0-9-]+)\.aac$/);
    if (audioMatch) {
      if (Object.hasOwn(referencePolicy.excluded, audioMatch[1])) return json(response, 404, { error: 'Reference removed from this library.' });
      const id = audioMatch[1];
      const ready = await firstExisting(localMedia(`${id}.aac`), new URL(`media/${id}.aac`, showcase));
      if (ready) return streamVideo(request, response, fileURLToPath(ready), 'audio/aac');
      const video = await firstExisting(localMedia(`${id}.mp4`), new URL(`media/${id}.mp4`, showcase));
      if (!video) return json(response, 404, { error: 'Audio unavailable.' });
      await mkdir(localMedia(''), { recursive: true });
      const audio = fileURLToPath(localMedia(`${id}.aac`));
      if (!(await extractAudio(fileURLToPath(video), audio))) return json(response, 404, { error: 'Audio unavailable.' });
      return streamVideo(request, response, audio, 'audio/aac');
    }
    const mediaMatch = pathname.match(/^\/media\/references\/([a-z0-9-]+)\.mp4$/);
    if (mediaMatch) {
      if (Object.hasOwn(referencePolicy.excluded, mediaMatch[1])) return json(response, 404, { error: 'Reference removed from this library.' });
      const video = await firstExisting(localMedia(`${mediaMatch[1]}.mp4`), new URL(`media/${mediaMatch[1]}.mp4`, showcase));
      return streamVideo(request, response, fileURLToPath(video || localMedia(`${mediaMatch[1]}.mp4`)));
    }
    if (pathname === '/') pathname = '/demo.html';
    else if (pathname === '/editor') pathname = '/editor.html';
    if (readOnly.has(pathname)) return json(response, 200, readOnly.get(pathname));
    const sourceMatch = pathname.match(/^\/api\/v1\/templates\/([^/]+)\/source$/);
    if (sourceMatch) {
      const template = templates.find(item => item.id === sourceMatch[1]);
      if (!template) return json(response, 404, { error: 'Template not found.' });
      pathname = '/' + template.preview.html;
    } else if (pathname.startsWith('/api/') || pathname === '/generate') {
      return json(response, 501, unsupported);
    }
    // Keep the inherited /null/ links working without involving another server.
    if (pathname === '/null') pathname = '/';
    else if (pathname.startsWith('/null/')) pathname = pathname.slice(5);
    if (pathname.startsWith('/references/') && !(await exists(path.resolve(root, '.' + pathname)))) {
      return serveFile(response, request, fileURLToPath(showcase), pathname);
    }
    return serveFile(response, request, root, pathname);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4343);
  const host = process.env.HOST || '127.0.0.1';
  createApp().listen(port, host, () => console.log(`Null UI: http://${host}:${port}`));
}
