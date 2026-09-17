import { readdir, readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { spawnSync } from 'node:child_process';

let count = 0;
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) { await check(url); continue; }
    if (!/\.(?:html|js)$/.test(entry.name)) continue;
    const source = await readFile(url, 'utf8');
    if (/https?:\/\/(?:127\.0\.0\.1|localhost):424[23]/.test(source)) throw new Error(`Personal companion URL: ${url}`);
    if (entry.name.endsWith('.js')) new Script(source, { filename: url.pathname });
    else for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=|application\/json|application\/ld\+json/.test(match[1])) continue;
      new Script(match[2], { filename: url.pathname });
    }
    count++;
  }
}
await check(new URL('../public/', import.meta.url));
for (const filename of ['server.js', 'scripts/check.js']) {
  const result = spawnSync(process.execPath, ['--check', filename], { stdio: 'inherit' });
  if (result.status) process.exit(result.status);
}
console.log(`Checked ${count} UI files; no personal companion URLs.`);
