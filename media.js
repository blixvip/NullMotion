import { createReadStream } from 'node:fs';
import { stat, rename, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';

/**
 * Parse a single-range HTTP `Range` header (`bytes=start-end`, `bytes=start-` or `bytes=-suffix`).
 * Returns `{ start, end }` (inclusive, clamped to the file) or `null` when the range is invalid or unsatisfiable.
 */
export function byteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value || '');
  if (!match || (!match[1] && !match[2]) || size < 1) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && start < size ? { start, end } : null;
}

/**
 * Stream a local media file to the response, honouring `Range` requests (206) so the browser can seek
 * without reading the whole file. Responds 404 when the file is missing and 416 for a bad range.
 */
export async function streamVideo(request, response, filename, type = 'video/mp4') {
  let size;
  try { size = (await stat(filename)).size; } catch {
    response.writeHead(404); response.end('Reference unavailable.'); return;
  }
  const range = request.headers.range ? byteRange(request.headers.range, size) : { start: 0, end: size - 1 };
  if (!range) { response.writeHead(416, { 'Content-Range': `bytes */${size}` }); response.end(); return; }
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': range.end - range.start + 1, 'Cache-Control': 'private, max-age=3600' };
  if (request.headers.range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
  response.writeHead(request.headers.range ? 206 : 200, headers);
  if (request.method === 'HEAD') { response.end(); return; }
  const stream = createReadStream(filename, range);
  stream.on('error', () => response.destroy());
  response.on('close', () => stream.destroy());
  stream.pipe(response);
}

// The preview export needs the reference's audio on its own. Extract it once as an ADTS AAC file
// (re-encoded at 192 kbps) and keep it beside the video; later requests reuse it. Concurrent
// requests for the same file share one FFmpeg run. Resolves to false if FFmpeg is missing or fails.
const extracting = new Map();
export function extractAudio(video, audio) {
  if (!extracting.has(audio)) {
    extracting.set(audio, (async () => {
      try { await stat(audio); return true; } catch {}
      const partial = audio + '.part';
      const ok = await new Promise(resolve => {
        const ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', video, '-vn', '-c:a', 'aac', '-b:a', '192k', '-f', 'adts', partial]);
        ffmpeg.on('error', () => resolve(false));
        ffmpeg.on('close', code => resolve(code === 0));
      });
      if (ok) await rename(partial, audio); else await unlink(partial).catch(() => {});
      return ok;
    })().finally(() => extracting.delete(audio)));
  }
  return extracting.get(audio);
}
