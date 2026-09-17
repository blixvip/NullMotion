import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

export function byteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value || '');
  if (!match || (!match[1] && !match[2]) || size < 1) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && start < size ? { start, end } : null;
}
export async function streamVideo(request, response, filename) {
  let size;
  try { size = (await stat(filename)).size; } catch {
    response.writeHead(404); response.end('Reference unavailable.'); return;
  }
  const range = request.headers.range ? byteRange(request.headers.range, size) : { start: 0, end: size - 1 };
  if (!range) { response.writeHead(416, { 'Content-Range': `bytes */${size}` }); response.end(); return; }
  const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Content-Length': range.end - range.start + 1, 'Cache-Control': 'private, max-age=3600' };
  if (request.headers.range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
  response.writeHead(request.headers.range ? 206 : 200, headers);
  if (request.method === 'HEAD') { response.end(); return; }
  const stream = createReadStream(filename, range);
  stream.on('error', () => response.destroy());
  response.on('close', () => stream.destroy());
  stream.pipe(response);
}
