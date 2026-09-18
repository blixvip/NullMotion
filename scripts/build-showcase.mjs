// Build the committed showcase: the only references published with the repository.
// Copies the chosen references' posters, sections, scene cuts and drafts from the local
// library into showcase/references/, and re-encodes their videos (1080p H.264, web-sized)
// plus an AAC track into showcase/media/. The rest of the library stays local and ignored.
import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SHOWCASE = ['69614b10fa87', '227b019e7968', '5db95a3a7c73'];
const root = new URL('../', import.meta.url), library = new URL('public/references/', root);
const out = new URL('showcase/', root), refs = new URL('references/', out), media = new URL('media/', out);
const path = url => fileURLToPath(url);
const ffmpeg = args => new Promise((resolve, reject) => {
  const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)));
});
const readJson = async name => JSON.parse(await readFile(new URL(name, library), 'utf8'));
const pick = object => Object.fromEntries(SHOWCASE.filter(id => object[id]).map(id => [id, object[id]]));

await rm(out, { recursive: true, force: true });
await mkdir(refs, { recursive: true }); await mkdir(media, { recursive: true });

const catalog = await readJson('catalog.json');
const references = catalog.references.filter(reference => SHOWCASE.includes(reference.id))
  .map(({ originalName, ...reference }) => reference);
await writeFile(new URL('catalog.json', refs), JSON.stringify({ references }, null, 2));
const drafts = await readJson('drafts.json');
await writeFile(new URL('drafts.json', refs), JSON.stringify({ aliases: {}, drafts: pick(drafts.drafts) }, null, 1));
await writeFile(new URL('sections.json', refs), JSON.stringify(pick(await readJson('sections.json')), null, 1));
await writeFile(new URL('cuts.json', refs), JSON.stringify(pick(await readJson('cuts.json'))));

for (const file of await readdir(library)) {
  if (SHOWCASE.some(id => file.startsWith(`${id}-`) && file.endsWith('.jpg'))) await copyFile(new URL(file, library), new URL(file, refs));
}
for (const id of SHOWCASE) {
  const source = path(new URL(`.local-media/${id}.mp4`, root)), video = path(new URL(`${id}.mp4`, media));
  await ffmpeg(['-i', source, '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'medium', '-threads', '2', '-crf', '20', '-maxrate', '6M', '-bufsize', '12M',
    '-pix_fmt', 'yuv420p', '-vf', 'scale=-2:min(1080\\,ih)', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', video]);
  await ffmpeg(['-i', video, '-vn', '-c:a', 'copy', '-f', 'adts', path(new URL(`${id}.aac`, media))]);
  console.log('showcase', id);
}
