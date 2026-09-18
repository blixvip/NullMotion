// Split every imported reference into 3–8 draft sections at real scene changes and
// save a contact sheet per reference (two frames per section) for authoring drafts.
// Writes public/references/sections.json, public/references/cuts.json (every detected scene
// change, used to time the beats inside a draft) and .artifacts/sections/<id>.jpg.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const run = (args, collect = false) => new Promise((resolve, reject) => {
  const child = spawn('ffmpeg', ['-hide_banner', ...args]);
  let log = ''; child.stderr.on('data', chunk => { if (collect) log += chunk; });
  child.on('error', reject); child.on('close', code => code === 0 ? resolve(log) : reject(new Error(`ffmpeg ${code}`)));
});

async function sceneCuts(file) {
  const log = await run(['-i', file, '-an', '-vf', "scale=320:-2,select='gt(scene,0.18)',showinfo", '-f', 'null', '-'], true);
  return [...log.matchAll(/pts_time:([\d.]+)/g)].map(match => Number(match[1]));
}

function plan(duration, cuts) {
  const count = Math.max(3, Math.min(8, Math.round(duration / 4.5)));
  const bounds = [0];
  for (let i = 1; i < count; i++) {
    const ideal = duration * i / count, previous = bounds.at(-1);
    const near = cuts.filter(cut => cut > previous + 1.2 && cut < duration - 1.2 && Math.abs(cut - ideal) < duration / count * .45);
    bounds.push(+(near.sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal))[0] ?? ideal).toFixed(2));
  }
  return bounds.map((start, i) => ({ start, end: +(bounds[i + 1] ?? duration).toFixed(3) }));
}

const catalog = JSON.parse(await readFile(new URL('public/references/catalog.json', root), 'utf8'));
const policy = JSON.parse(await readFile(new URL('data/reference-policy.json', root), 'utf8'));
await mkdir(new URL('.artifacts/sections/', root), { recursive: true });
const result = {}, allCuts = {};
for (const reference of catalog.references) {
  if (policy.excluded?.[reference.id]) continue;
  const file = fileURLToPath(new URL(`.local-media/${reference.id}.mp4`, root));
  const cuts = await sceneCuts(file);
  allCuts[reference.id] = cuts.map(cut => +cut.toFixed(2));
  const sections = plan(reference.duration, cuts);
  result[reference.id] = sections;
  const times = sections.flatMap(({ start, end }) => [start + (end - start) * .3, start + (end - start) * .8]);
  const select = times.map(t => `lt(prev_t\\,${t.toFixed(2)})*gte(t\\,${t.toFixed(2)})`).join('+');
  await run(['-y', '-loglevel', 'error', '-i', file, '-an', '-vf', `select='${select}',scale=320:-2,tile=2x${sections.length}:padding=4`, '-frames:v', '1', '-vsync', 'vfr',
    fileURLToPath(new URL(`.artifacts/sections/${reference.id}.jpg`, root))]);
  console.log(reference.id, sections.map(s => `${s.start}-${s.end}`).join(' '));
}
await writeFile(new URL('public/references/sections.json', root), JSON.stringify(result, null, 1));
await writeFile(new URL('public/references/cuts.json', root), JSON.stringify(allCuts));
