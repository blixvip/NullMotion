// Precompute a small audio envelope for every imported reference so the timeline can
// draw a waveform without the browser decoding multi-hundred-megabyte source videos.
// Writes public/references/<id>.wave.json ({ rate, peaks }) next to the thumbnails.
import { spawn } from 'node:child_process';
import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const RATE = 50, SAMPLE_RATE = 4000, WINDOW = SAMPLE_RATE / RATE;
const root = new URL('../', import.meta.url);
const force = process.argv.includes('--force');

function envelope(file) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', 'pipe:1']);
    const peaks = []; let peak = 0, count = 0, carry = Buffer.alloc(0);
    ffmpeg.stdout.on('data', chunk => {
      const data = carry.length ? Buffer.concat([carry, chunk]) : chunk;
      const usable = data.length - (data.length % 2);
      for (let offset = 0; offset < usable; offset += 2) {
        peak = Math.max(peak, Math.abs(data.readInt16LE(offset)));
        if (++count === WINDOW) { peaks.push(peak); peak = 0; count = 0; }
      }
      carry = data.subarray(usable);
    });
    ffmpeg.on('error', reject);
    ffmpeg.on('close', code => code === 0 ? resolve(peaks) : reject(new Error(`ffmpeg exited ${code}`)));
  });
}

const catalog = JSON.parse(await readFile(new URL('public/references/catalog.json', root), 'utf8'));
for (const reference of catalog.references || []) {
  const output = new URL(`public/references/${reference.id}.wave.json`, root);
  if (!force) { try { await access(output); continue; } catch {} }
  try {
    const peaks = await envelope(fileURLToPath(new URL(`.local-media/${reference.id}.mp4`, root)));
    const max = Math.max(1, ...peaks);
    await writeFile(output, JSON.stringify({ rate: RATE, peaks: peaks.map(value => Math.round(value / max * 100)) }));
    console.log(`${reference.id}  ${peaks.length} peaks`);
  } catch (error) { console.warn(`${reference.id}  skipped: ${error.message}`); }
}
