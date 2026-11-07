import { buildScrap, scrapNames } from './scraps.mjs';
import { buildDraft } from './drafts.mjs';
import { HAND_BUILT, planSections } from './sections.mjs';

// The full reference plays on top; below it, the super-simple HyperFrames drafts it grew
// from — one per section. The draft for the section on screen follows the film exactly;
// the rest keep looping their own part. Each draft is as wide as its section is long, and
// the playhead runs straight across them.
const $ = id => document.getElementById(id);
const video = $('final-video');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let references = [], drafts = { aliases: {}, drafts: {} }, bounds = {}, cuts = {}, current = null, duration = 1;
let sections = [], clock = performance.now(), dragging = false, exporting = null;

const clockText = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const preciseText = t => `${clockText(t)}.${Math.floor((t % 1) * 10)}`;
const sectionAt = t => Math.max(0, sections.findLastIndex(section => t >= section.start));
const shortName = reference => reference.name.split(' · ')[0].split('  ')[0];

// ---------- Sections ----------
function buildSections() {
  sections.forEach(section => section.timeline?.kill());
  sections = planSections(current, { duration, drafts, bounds, cuts, names: scrapNames });
  const row = $('scraps'); row.replaceChildren(); row.dataset.count = sections.length;
  sections.forEach(section => {
    section.length = section.end - section.start;
    const segment = document.createElement('div');
    segment.className = 'seg';
    segment.setAttribute('role', 'listitem');
    const card = document.createElement('div'); card.className = 'scrap';
    const canvas = document.createElement('div'); canvas.className = 'scrap-canvas';
    const name = document.createElement('div'); name.className = 'seg-name'; name.textContent = section.name;
    card.append(canvas); segment.append(card, name); row.append(segment);
    section.canvas = canvas; section.card = card; section.segment = segment;
    section.timeline = section.scrap !== undefined ? buildScrap(section.scrap, canvas, section.length) : buildDraft(canvas, section.beats, section.length, section.palette, section.starts);
    section.loop = section.length * .55;
  });
  $('time-total').textContent = clockText(duration);
  $('bar-meta').textContent = `${shortName(current)} · from ${sections.length} HyperFrames drafts`;
  layout();
}

// ---------- Geometry shared by the page and the export ----------
function spans() {
  const origin = $('strip').getBoundingClientRect().left;
  return sections.map(section => { const box = section.card.getBoundingClientRect(); return { left: box.left - origin, width: box.width }; });
}
function timeToX(time, layout) {
  const index = sectionAt(time), box = layout[index], section = sections[index];
  if (!box) return 0;
  return box.left + box.width * Math.min(1, Math.max(0, (time - section.start) / section.length));
}

function layout() {
  for (const section of sections) section.card.style.setProperty('--scale', section.card.clientWidth / 640);
  $('strip').style.setProperty('--card-h', `${sections[0]?.card.clientHeight || 60}px`);
  render();
}

function render() {
  if (exporting) return; // the export drives the drafts' timelines itself
  const now = performance.now(), delta = (now - clock) / 1000; clock = now;
  const time = video.currentTime || 0, active = sectionAt(time), layout = spans();
  sections.forEach((section, index) => {
    const isActive = index === active;
    if (!video.paused && !reducedMotion) section.loop = (section.loop + delta) % section.length;
    section.timeline.seek(isActive ? time - section.start : section.loop, false);
    section.segment.classList.toggle('active', isActive);
  });
  $('playhead').style.left = `${timeToX(time, layout)}px`;
  $('seek').value = time; $('seek').max = duration;
  $('time-now').textContent = preciseText(time);
  document.querySelector('.final').classList.toggle('paused', video.paused);
}
function frame() { render(); requestAnimationFrame(frame); }

// ---------- Library ----------
function renderLibrary() {
  $('library').replaceChildren(...references.map(reference => {
    const item = document.createElement('div');
    item.setAttribute('role', 'listitem');
    const card = document.createElement('button');
    card.type = 'button'; card.className = 'video-card'; card.dataset.id = reference.id;
    card.innerHTML = '<span class="video-thumb"><img alt="" loading="lazy"><span class="video-length"></span></span><span class="video-name"></span>';
    card.querySelector('img').src = reference.poster;
    card.querySelector('.video-length').textContent = clockText(reference.duration);
    card.querySelector('.video-name').textContent = reference.name;
    card.addEventListener('click', () => { load(reference); scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' }); });
    card.addEventListener('mouseenter', () => hoverPreview(card, reference));
    card.addEventListener('mouseleave', () => card.querySelector('video')?.remove());
    item.append(card);
    return item;
  }));
  $('library-count').textContent = `${references.length} references`;
}
function hoverPreview(card, reference) {
  if (reducedMotion || !matchMedia('(hover: hover)').matches) return;
  const player = Object.assign(document.createElement('video'), { muted: true, playsInline: true, loop: true, preload: 'metadata', src: reference.src });
  player.addEventListener('loadedmetadata', () => { player.currentTime = Math.min(reference.duration * .3, 4); player.play().catch(() => {}); });
  card.querySelector('.video-thumb').append(player);
}

function load(reference) {
  if (exporting || current?.id === reference.id) return;
  current = reference; duration = reference.duration;
  video.src = reference.src; video.poster = reference.poster;
  video.muted = !soundSaved(); soundBlocked = false; soundSync(); // restore the saved choice; first visit stays muted
  document.querySelectorAll('.video-card').forEach(card => card.classList.toggle('current', card.dataset.id === reference.id));
  history.replaceState(null, '', reference.id === HAND_BUILT.id ? '/' : `/?v=${encodeURIComponent(reference.id)}`);
  buildSections();
  if (!reducedMotion) playPreview();
}

// ---------- Controls ----------
function seekFrom(event) {
  const layout = spans(), x = event.clientX - $('strip').getBoundingClientRect().left;
  let index = layout.findIndex(box => x < box.left + box.width + 3);
  if (index < 0) index = layout.length - 1;
  const box = layout[index], section = sections[index];
  video.currentTime = Math.min(duration - .01, section.start + section.length * Math.min(1, Math.max(0, (x - box.left) / box.width)));
  render();
}
$('strip').addEventListener('pointerdown', event => { if (exporting) return; dragging = true; $('strip').setPointerCapture(event.pointerId); seekFrom(event); });
$('strip').addEventListener('pointermove', event => { if (dragging) seekFrom(event); });
$('strip').addEventListener('pointerup', () => { dragging = false; });
$('seek').addEventListener('input', () => { video.currentTime = Number($('seek').value); render(); });
$('final-toggle').addEventListener('click', () => {
  if (exporting) return;
  if (video.paused) video.play().catch(() => {}); else video.pause();
  $('final-toggle').setAttribute('aria-label', video.paused ? 'Play' : 'Pause');
});
// ---------- Sound ----------
// Browsers refuse autoplay with sound, so only a visitor who has already asked for sound
// starts unmuted — and even then playback falls back to muted when the browser still says
// no, keeping the saved choice for the next click. localStorage can throw in private
// windows; the toggle then simply lives for the session.
const SOUND_KEY = 'nullmotion-sound';
const soundSaved = () => { try { return localStorage.getItem(SOUND_KEY) === 'on'; } catch { return false; } };
const soundRemember = unmuted => { try { localStorage.setItem(SOUND_KEY, unmuted ? 'on' : 'off'); } catch {} };
let soundBlocked = false; // autoplay with sound was refused; mute for now, keep the saved choice
function soundSync() {
  const blocked = soundBlocked && video.muted;
  $('sound').textContent = blocked ? 'Sound blocked · click to enable' : video.muted ? 'Sound off' : 'Sound on';
  $('sound').setAttribute('aria-pressed', !video.muted);
  $('sound').setAttribute('aria-label', blocked ? 'Enable sound' : video.muted ? 'Unmute' : 'Mute');
}
function playPreview() {
  video.play().catch(error => {
    if (video.muted || error?.name !== 'NotAllowedError') return;
    video.muted = true; soundBlocked = true; soundSync(); // muted fallback now, saved sound for the next click
    video.play().catch(() => {});
  });
}

$('sound').addEventListener('click', () => {
  video.muted = !video.muted;
  soundBlocked = false; // the click is the user's explicit choice; the hint no longer applies

  // Save the user's explicit sound preference.
  soundRemember(!video.muted);
  soundSync();

  // Retry playback after the user interacts with the sound button.
  if (video.paused) {
    video.play().catch(() => {});
  }
});

document.addEventListener('keydown', event => {
  if (event.target.closest('button, input, a')) return;
  if (event.code === 'Space') { event.preventDefault(); $('final-toggle').click(); return; }
  if (exporting || !sections.length) return;
  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    event.preventDefault();
    const active = sectionAt(video.currentTime || 0);
    const next = event.code === 'ArrowRight' ? Math.min(sections.length - 1, active + 1) : Math.max(0, active - 1);
    video.currentTime = sections[next].start;
    render();
    return;
  }
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    video.currentTime = event.key === 'Home' ? 0 : duration;
    render();
    return;
  }
  if (video.paused && (event.key === ',' || event.key === '.')) {
    event.preventDefault();
    const step = 1 / 30;
    video.currentTime = Math.min(duration, Math.max(0, video.currentTime + (event.key === ',' ? -step : step)));
    render();
  }
});
new ResizeObserver(layout).observe($('stage'));

// ---------- Download ----------
// "Whole preview" renders the film and its drafts frame by frame, not in real time: a hidden
// copy of the film plays, every decoded frame is captured exactly once, the drafts are drawn
// at that frame's exact time, and the result is encoded at a high bitrate with the frame's
// own timestamp (WebCodecs + mp4-muxer). The film's audio is added from the reference.
// The frame is the film plus the drafts and their names, with a thin margin of page.
const EXPORT_WIDTH = 1920, EXPORT_MARGIN = 20;
function exportGeometry() {
  const film = document.querySelector('.final').getBoundingClientRect(), strip = $('strip').getBoundingClientRect();
  const left = film.left - EXPORT_MARGIN, top = film.top - EXPORT_MARGIN;
  const scale = EXPORT_WIDTH / (film.width + EXPORT_MARGIN * 2);
  const map = rect => ({ x: (rect.left - left) * scale, y: (rect.top - top) * scale, w: rect.width * scale, h: rect.height * scale });
  const playhead = $('playhead').getBoundingClientRect();
  return {
    scale, width: EXPORT_WIDTH, height: Math.round((strip.bottom - film.top + EXPORT_MARGIN * 2) * scale / 2) * 2,
    film: map(film), layout: spans(), stripLeft: (strip.left - left) * scale, playheadTop: (playhead.top - top) * scale, playheadHeight: playhead.height * scale,
    cards: sections.map(section => map(section.card.getBoundingClientRect())),
    names: sections.map(section => map(section.segment.querySelector('.seg-name').getBoundingClientRect()))
  };
}
function rasterize(section) {
  const node = section.canvas.cloneNode(true); node.style.transform = 'none';
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><foreignObject width="640" height="360">${new XMLSerializer().serializeToString(node)}</foreignObject></svg>`;
  const image = new Image(); image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
  return image.decode().then(() => image, () => null);
}
async function drawExportFrame(context, geometry, film, time) {
  const { scale } = geometry, active = sectionAt(time);
  const rounded = (x, y, w, h, r) => { context.beginPath(); context.roundRect(x, y, w, h, r); };
  // Same rule as the page: the current section follows the film, the rest loop their part.
  sections.forEach((section, index) => section.timeline.seek(index === active ? time - section.start : (section.length * .55 + time) % section.length, false));
  const drafts = await Promise.all(sections.map(rasterize));
  context.fillStyle = '#0b0b0c'; context.fillRect(0, 0, geometry.width, geometry.height);
  const f = geometry.film;
  // Centered crop, like the page's object-fit: cover, so a vertical reference is not stretched.
  const scaleToCover = Math.max(f.w / film.displayWidth, f.h / film.displayHeight);
  const sourceW = f.w / scaleToCover, sourceH = f.h / scaleToCover;
  const sourceX = (film.displayWidth - sourceW) / 2, sourceY = (film.displayHeight - sourceH) / 2;
  context.save(); rounded(f.x, f.y, f.w, f.h, 14 * scale); context.clip(); context.drawImage(film, sourceX, sourceY, sourceW, sourceH, f.x, f.y, f.w, f.h); context.restore();
  context.textBaseline = 'middle'; context.textAlign = 'center'; context.font = `500 ${12.5 * scale}px Inter, system-ui, sans-serif`;
  sections.forEach((section, index) => {
    const { x, y, w, h } = geometry.cards[index], isActive = index === active;
    context.save(); rounded(x, y, w, h, 8 * scale); context.clip();
    context.fillStyle = '#ffffff'; context.fillRect(x, y, w, h);
    if (drafts[index]) context.drawImage(drafts[index], x, y, w, h);
    context.restore();
    const line = (isActive ? 2 : 1) * scale;
    context.strokeStyle = isActive ? '#ff5a1f' : '#222225'; context.lineWidth = line;
    rounded(x - line / 2, y - line / 2, w + line, h + line, 8 * scale + line / 2); context.stroke();
    const name = geometry.names[index];
    context.save(); context.beginPath(); context.rect(name.x, name.y - 4 * scale, name.w, name.h + 8 * scale); context.clip();
    context.fillStyle = isActive ? '#ededee' : '#7d7d83'; context.fillText(section.name, name.x + name.w / 2, name.y + name.h / 2);
    context.restore();
  });
  const px = geometry.stripLeft + timeToX(time, geometry.layout) * scale, py = geometry.playheadTop;
  // White with a thin dark edge, as on the page, so it reads over white drafts too.
  context.fillStyle = 'rgba(0,0,0,.45)'; context.fillRect(px - 2 * scale, py + 5 * scale, 4 * scale, geometry.playheadHeight - 5 * scale);
  context.beginPath(); context.arc(px, py + 5 * scale, 6 * scale, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#ffffff'; context.fillRect(px - scale, py + 5 * scale, 2 * scale, geometry.playheadHeight - 5 * scale);
  context.beginPath(); context.arc(px, py + 5 * scale, 5 * scale, 0, Math.PI * 2); context.fill();
}
async function referenceAudio(reference) {
  try {
    const response = await fetch(reference.src.replace(/\.mp4$/, '.aac'));
    if (!response.ok) return null;
    return await new OfflineAudioContext(2, 1, 48000).decodeAudioData(await response.arrayBuffer());
  } catch { return null; }
}
async function encodeAudio(buffer, muxer, start, end) {
  let failure = null;
  const encoder = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: error => { failure = error; } });
  const channels = buffer.numberOfChannels, rate = buffer.sampleRate;
  encoder.configure({ codec: 'mp4a.40.2', sampleRate: rate, numberOfChannels: channels, bitrate: 192000 });
  // Trim to [start, end) of the reference, but timestamp from 0 so the MP4 starts at its first frame.
  const first = Math.round(start * rate), total = Math.min(buffer.length, Math.round(end * rate)), step = rate;
  for (let offset = first; offset < total && !failure; offset += step) {
    const frames = Math.min(step, total - offset), data = new Float32Array(frames * channels);
    for (let c = 0; c < channels; c++) data.set(buffer.getChannelData(c).subarray(offset, offset + frames), c * frames);
    const chunk = new AudioData({ format: 'f32-planar', sampleRate: rate, numberOfFrames: frames, numberOfChannels: channels, timestamp: Math.round((offset - first) / rate * 1e6), data });
    encoder.encode(chunk); chunk.close();
  }
  await encoder.flush(); encoder.close();
  if (failure) throw failure;
}
function save(url, name) {
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link); link.click(); link.remove();
}
const fileName = reference => reference.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || reference.id;
// Exports the reference's [start, end) range in seconds; the MP4 always starts at 0.
async function exportPreview(start = 0, end = Infinity, suffix = 'null-preview') {
  if (exporting || !current) return;
  if (!('VideoEncoder' in window) || !('requestVideoFrameCallback' in HTMLVideoElement.prototype)) {
    $('download-label').textContent = 'Needs Chrome or Edge'; setTimeout(() => { $('download-label').textContent = 'Download'; }, 2500); return;
  }
  const reference = current, geometry = exportGeometry(), wasPlaying = !video.paused;
  start = Math.max(0, start); end = Math.min(reference.duration, end);
  if (!(end > start)) return;
  exporting = true; video.pause(); $('download').disabled = true; $('download-label').textContent = 'Preparing…';
  const canvas = Object.assign(document.createElement('canvas'), { width: geometry.width, height: geometry.height });
  const context = canvas.getContext('2d');
  const film = Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto', src: reference.src });
  film.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
  document.body.append(film);
  let encoder;
  try {
    const [audio] = await Promise.all([referenceAudio(reference), new Promise((resolve, reject) => { film.onloadeddata = resolve; film.onerror = reject; })]);
    if (start > 0) await new Promise(resolve => { film.onseeked = resolve; film.currentTime = start; });
    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(), fastStart: 'in-memory', firstTimestampBehavior: 'offset',
      video: { codec: 'avc', width: geometry.width, height: geometry.height },
      ...(audio ? { audio: { codec: 'aac', numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate } } : {})
    });
    let failure = null;
    encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: error => { failure = error; } });
    encoder.configure({ codec: 'avc1.640033', width: geometry.width, height: geometry.height, bitrate: 24e6, framerate: 30, latencyMode: 'quality', avc: { format: 'avc' } });

    // Capture every decoded frame. If encoding falls behind, pause the hidden film until it
    // catches up, so no frame is ever skipped.
    const queue = []; let ended = false, lastKey = -Infinity, lastTime = -1, working = false, wake = null;
    const capture = (now, meta) => {
      if (meta.mediaTime >= end - 1e-3) { ended = true; film.pause(); wake?.(); return; }
      if (meta.mediaTime > lastTime) { lastTime = meta.mediaTime; queue.push({ time: meta.mediaTime, frame: new VideoFrame(film, { timestamp: Math.round(meta.mediaTime * 1e6) }) }); }
      if (queue.length >= 2) film.pause();
      if (!ended) film.requestVideoFrameCallback(capture);
      wake?.();
    };
    film.requestVideoFrameCallback(capture);
    film.onended = () => { ended = true; wake?.(); };
    film.playbackRate = .5; // headroom so the renderer never lets a frame slip by
    await film.play();
    const renderStartedAt = performance.now();
    while (!failure) {
      if (!queue.length) {
        if (ended) break;
        if (film.paused && !working) film.play().catch(() => {});
        await new Promise(resolve => { wake = resolve; setTimeout(resolve, 250); }); wake = null;
        continue;
      }
      working = true;
      const { time, frame } = queue.shift();
      await drawExportFrame(context, geometry, frame, time); frame.close();
      const offset = time - start;
      const output = new VideoFrame(canvas, { timestamp: Math.round(offset * 1e6) });
      const keyFrame = offset - lastKey >= 2; if (keyFrame) lastKey = offset;
      encoder.encode(output, { keyFrame }); output.close();
      while (encoder.encodeQueueSize > 4) await new Promise(resolve => setTimeout(resolve, 5));
      working = false;
      if (film.paused && !ended && queue.length < 2) film.play().catch(() => {});
      const progress = Math.min(1, Math.max(0, offset / (end - start)));
      const percent = Math.min(99, Math.floor(progress * 100));
      const elapsed = (performance.now() - renderStartedAt) / 1000;
      let label = `Rendering ${percent}%`;
      if (elapsed >= 2 && progress > 0 && progress < 1) {
        const remaining = Math.ceil(elapsed * (1 - progress) / progress);
        label += ` · ~${clockText(remaining)} left`;
      }
      $('download-label').textContent = label;
    }
    queue.forEach(item => item.frame.close());
    if (failure) throw failure;
    await encoder.flush();
    if (audio) { $('download-label').textContent = 'Adding sound…'; await encodeAudio(audio, muxer, start, Math.min(end, lastTime + 1 / 30)); }
    muxer.finalize();
    const url = URL.createObjectURL(new Blob([muxer.target.buffer], { type: 'video/mp4' }));
    save(url, `${fileName(reference)}-${suffix}.mp4`);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    $('download-label').textContent = 'Download';
  } catch (error) {
    console.error('Export failed', error);
    $('download-label').textContent = 'Export failed';
    setTimeout(() => { $('download-label').textContent = 'Download'; }, 3000);
  } finally {
    if (encoder && encoder.state !== 'closed') encoder.close();
    film.pause(); film.removeAttribute('src'); film.load(); film.remove();
    exporting = null; $('download').disabled = false;
    if (wasPlaying) playPreview();
  }
}
function toggleMenu(open = $('download-menu').hidden) {
  const menu = $('download-menu');
  menu.hidden = !open; $('download').setAttribute('aria-expanded', open);
  if (open) $('download-all').focus();
  else if (menu.contains(document.activeElement)) $('download').focus();
}
$('download').addEventListener('click', () => toggleMenu());
$('download-all').addEventListener('click', () => { toggleMenu(false); exportPreview(); });
$('download-section').addEventListener('click', () => {
  toggleMenu(false);
  const section = sections[sectionAt(video.currentTime || 0)];
  if (section) exportPreview(section.start, section.end, 'section');
});
$('download-final').addEventListener('click', () => { toggleMenu(false); if (current) save(current.src, `${fileName(current)}.mp4`); });
document.addEventListener('click', event => { if (!event.target.closest('.download')) toggleMenu(false); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('download-menu').hidden) toggleMenu(false); });

async function start() {
  const json = async url => { try { const response = await fetch(url); return response.ok ? await response.json() : null; } catch { return null; } };
  const [catalog, spec, planned, changes] = await Promise.all([json('/api/references'), json('/references/drafts.json'), json('/references/sections.json'), json('/references/cuts.json')]);
  references = catalog?.references || []; drafts = spec || drafts; bounds = planned || {}; cuts = changes || {};
  if (!references.length) {
    const notice = document.createElement('div'); notice.className = 'notice';
    notice.textContent = 'No references found. The showcase should ship with this repo — if you are building from a sparse checkout, run npm run showcase, or import your own with scripts/import-motionclone.py.';
    document.querySelector('.final').append(notice);
    return;
  }
  renderLibrary();
  const wanted = new URLSearchParams(location.search).get('v');
  load(references.find(reference => reference.id === wanted) || references.find(reference => reference.id === HAND_BUILT.id) || references[0]);
  requestAnimationFrame(frame);
}
start();
