import { splitReference, locateClip, moveClip, sequenceDuration } from './editor-model.mjs';

const $ = id => document.getElementById(id);
const video = $('preview-video');
const STORAGE = 'null-launch-studio-v1';
const state = { references: [], clips: [], selected: 0, activeReference: 'all', current: 0, playing: false, mode: 'concept', past: [], future: [], dragged: null, dialogSegment: null, initialized: false };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let frame = 0, toastTimer = 0, hoveredVideo = null, dialogTrigger = null, savedTimer = 0;
const refFor = id => state.references.find(reference => reference.id === id);
const total = () => sequenceDuration(state.clips);
const startOf = index => sequenceDuration(state.clips.slice(0, index));
const seconds = n => `${Number(n).toFixed(1)}s`;
function timecode(time) {
  const centiseconds = Math.max(0, Math.round((Number(time) || 0) * 100));
  return `${String(Math.floor(centiseconds / 6000)).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function toast(message) {
  $('toast').textContent = message; $('toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2800);
}
function persist() {
  if (!state.initialized) return;
  try {
    localStorage.setItem(STORAGE, JSON.stringify({ clips: state.clips.filter(clip => !refFor(clip.ref)?.uploaded), brand: $('brand-name').value, message: $('brand-message').value, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), paper: getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(), aspect: $('aspect').value }));
    $('save-state').lastChild.textContent = ' Saved locally';
  } catch { $('save-state').lastChild.textContent = ' Not saved'; }
}
function snapshot() {
  state.past.push(structuredClone(state.clips));
  if (state.past.length > 30) state.past.shift();
  state.future = [];
}
function restoreHistory(direction) {
  const source = direction === 'undo' ? state.past : state.future;
  const destination = direction === 'undo' ? state.future : state.past;
  if (!source.length) return;
  pause(); destination.push(structuredClone(state.clips)); state.clips = source.pop();
  state.selected = Math.max(0, Math.min(state.selected, state.clips.length - 1));
  renderTimeline(); seek(startOf(state.selected)); persist();
}
function demoClips() {
  const picks = [0, 1, 2, 4].filter(index => state.references[index]);
  return picks.map((referenceIndex, index) => {
    const reference = state.references[referenceIndex];
    const segment = reference.segments[Math.min(index % 3, reference.segments.length - 1)];
    return { ...segment, label: ['The opening', 'The build', 'The reveal', 'The close'][index] };
  });
}
function loadDemo() {
  if (!state.references.length) return toast('Add a reference video to begin.');
  snapshot(); pause(); state.clips = demoClips(); state.selected = 0;
  renderTimeline(); seek(0); persist(); toast('Four moments. One new direction.');
}
function brand() {
  const name = $('brand-name').value.trim() || 'Your brand';
  $('film-brand-name').textContent = name;
  document.querySelector('.brand-track-name').textContent = name;
  document.querySelector('.film-monogram').textContent = name[0].toUpperCase();
  const message = $('brand-message').value.trim() || 'Good ideas. Great motion.';
  const split = message.indexOf('. ');
  const headline = $('film-headline'); headline.replaceChildren();
  if (split > -1) headline.append(document.createTextNode(message.slice(0, split + 1)), document.createElement('br'), element('em', '', message.slice(split + 2)));
  else headline.textContent = message;
  clearTimeout(savedTimer); savedTimer = setTimeout(persist, 250);
}
function palette(accent, paper) {
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--paper', paper);
  document.querySelectorAll('.swatch').forEach(button => {
    const active = button.dataset.accent.toLowerCase() === accent.toLowerCase();
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
  });
  $('custom-color').value = accent;
  persist();
}
function setAspect() {
  $('canvas-wrap').classList.toggle('portrait', $('aspect').value === 'portrait');
  $('canvas-wrap').classList.toggle('square', $('aspect').value === 'square');
  $('format-label').textContent = { landscape: '1920 × 1080', portrait: '1080 × 1920', square: '1080 × 1080' }[$('aspect').value];
  persist();
}
function renderTimeline() {
  const track = $('clips-track'); track.replaceChildren();
  if (!state.clips.length) track.append(element('div', 'empty-track', 'Your next film starts here. Add a moment below.'));
  state.clips.forEach((clip, index) => {
    const reference = refFor(clip.ref);
    const button = element('button', `timeline-clip${index === state.selected ? ' selected' : ''}`);
    button.style.flexGrow = clip.out - clip.in;
    button.style.flexBasis = '0'; button.type = 'button'; button.draggable = true; button.dataset.index = index;
    button.setAttribute('aria-label', `Clip ${index + 1}: ${reference?.name || 'Reference'}, ${seconds(clip.out - clip.in)}`);
    button.setAttribute('aria-pressed', index === state.selected);
    const image = element('img'); image.src = clip.poster || reference?.poster || ''; image.alt = ''; image.draggable = false;
    const caption = element('span', '', clip.label || reference?.name || 'Reference');
    caption.prepend(element('small', '', `${String(index + 1).padStart(2, '0')}  ·  ${seconds(clip.out - clip.in)}`));
    button.append(image, caption);
    button.addEventListener('click', () => { state.selected = index; pause(); seek(startOf(index)); renderSelection(); });
    button.addEventListener('dragstart', event => { state.dragged = { type: 'clip', index }; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); button.classList.add('dragging'); });
    button.addEventListener('dragend', () => { state.dragged = null; button.classList.remove('dragging'); });
    track.append(button);
  });
  $('clip-count').textContent = `${state.clips.length} clips`;
  $('time-total').textContent = timecode(total()); $('scrubber').max = Math.max(total(), .01);
  $('ruler').replaceChildren(...Array.from({ length: 9 }, (_, i) => element('span', '', `${Math.round(total() * i / 8)}s`)));
  $('undo').disabled = !state.past.length; $('redo').disabled = !state.future.length;
  $('play').disabled = $('play-top').disabled = !state.clips.length;
  renderSelection(); updatePlayhead();
}
function renderSelection() {
  document.querySelectorAll('.timeline-clip').forEach((button, index) => {
    button.classList.toggle('selected', index === state.selected); button.setAttribute('aria-pressed', index === state.selected);
  });
  const clip = state.clips[state.selected];
  for (const id of ['clip-in', 'clip-out', 'move-left', 'move-right', 'remove-clip']) $(id).disabled = !clip;
  $('selected-clip-name').textContent = clip ? `${String(state.selected + 1).padStart(2, '0')}  /  ${refFor(clip.ref)?.name || 'Reference'}` : 'Choose a reference moment below';
  $('clip-in').value = clip ? clip.in.toFixed(2) : ''; $('clip-out').value = clip ? clip.out.toFixed(2) : '';
  if (clip) {
    $('clip-in').max = $('clip-out').max = refFor(clip.ref)?.duration || 0;
    $('move-left').disabled = state.selected === 0; $('move-right').disabled = state.selected === state.clips.length - 1;
  }
}
function updatePlayhead() {
  const percent = total() ? state.current / total() : 0;
  $('playhead').style.left = `calc(77px + (100% - 77px) * ${Math.min(1, percent)})`;
  $('scrubber').value = state.current; $('time-current').textContent = timecode(state.current);
}
function updateScene(index) {
  const clip = state.clips[index]; if (!clip) return;
  $('film-stage').dataset.scene = index % 4;
  $('film-progress').textContent = `${String(index + 1).padStart(2, '0')} / ${String(state.clips.length).padStart(2, '0')}`;
  $('window-label').textContent = ['a new perspective', 'find your flow', 'made to stand out', 'your next chapter'][index % 4];
  $('film-kicker').textContent = ['MAKE SOMETHING THAT MOVES.', 'A DIFFERENT KIND OF ENERGY.', 'EVERY DETAIL. YOUR DIRECTION.', 'READY FOR YOUR NEXT CHAPTER.'][index % 4];
  $('film-subline').textContent = ['Your vision. Every frame.', 'One spark. Endless possibilities.', 'Built around your big idea.', 'This is where it begins.'][index % 4];
  $('preview-description').textContent = `${clip.label || `Moment ${index + 1}`} · ${refFor(clip.ref)?.name || 'Reference'}`;
}
function seek(time) {
  state.current = Math.max(0, Math.min(Number(time) || 0, total())); updatePlayhead();
  const position = locateClip(state.clips, state.current);
  if (!position) { video.pause(); video.removeAttribute('src'); delete video.dataset.reference; video.onloadedmetadata = null; video.load(); $('video-loading').hidden = false; $('video-loading').textContent = 'Add a reference moment to begin.'; return; }
  state.selected = position.index;
  const reference = refFor(state.clips[position.index].ref);
  if (!reference) return;
  updateScene(position.index); renderSelection();
  if (video.dataset.reference !== reference.id) {
    $('video-loading').hidden = false; $('video-loading').textContent = 'Loading your reference…';
    video.dataset.reference = reference.id; video.src = reference.src;
  }
  const apply = () => { video.currentTime = position.local; if (state.playing) video.play().catch(() => { pause(); toast('Press play to start the preview.'); }); };
  if (video.readyState >= 1) { video.onloadedmetadata = null; apply(); }
  else video.onloadedmetadata = apply;
}
function playButtons() {
  $('play').innerHTML = state.playing ? '<span aria-hidden="true">Ⅱ</span>' : '<svg><use href="#i-play"/></svg>';
  $('play').setAttribute('aria-label', state.playing ? 'Pause sequence' : 'Play sequence');
  $('play-top').innerHTML = state.playing ? 'Ⅱ &nbsp; Pause concept' : '<svg><use href="#i-play"/></svg>Play concept';
}
function tick() {
  if (!state.playing) return;
  const position = locateClip(state.clips, state.current);
  const clip = position && state.clips[position.index];
  if (!clip) return pause();
  if (video.readyState >= 2 && !video.seeking) {
    if (video.currentTime >= clip.out - .035 || video.ended) {
      const next = position.index + 1;
      if (next >= state.clips.length) { state.current = total(); updatePlayhead(); return pause(); }
      seek(startOf(next) + .001);
    } else { state.current = Math.min(total(), startOf(position.index) + Math.max(0, video.currentTime - clip.in)); updatePlayhead(); }
  }
  frame = requestAnimationFrame(tick);
}
function pause() { state.playing = false; video.pause(); cancelAnimationFrame(frame); playButtons(); }
function togglePlay() {
  if (state.playing) return pause();
  if (!state.clips.length) return;
  stopHover(); state.playing = true;
  seek(state.current >= total() - .05 ? 0 : state.current);
  playButtons(); cancelAnimationFrame(frame); frame = requestAnimationFrame(tick);
}
video.addEventListener('loadeddata', () => { $('video-loading').hidden = true; });
video.addEventListener('error', () => { $('video-loading').hidden = false; $('video-loading').textContent = 'Reference unavailable. Choose another moment.'; pause(); });
function addSegment(segment, index = state.clips.length) {
  if (state.clips.length >= 24) return toast('This concept can hold up to 24 moments.');
  snapshot(); pause(); state.clips.splice(index, 0, { ...segment }); state.selected = index;
  renderTimeline(); seek(startOf(index)); persist(); toast(`Moment added · ${seconds(total())} in your film`);
}
function reorder(from, to) {
  if (from === to || to < 0 || to >= state.clips.length) return;
  snapshot(); pause(); state.clips = moveClip(state.clips, from, to); state.selected = to;
  renderTimeline(); seek(startOf(to)); persist();
}
function removeClip() {
  if (!state.clips.length) return;
  snapshot(); pause(); state.clips.splice(state.selected, 1);
  state.selected = Math.max(0, Math.min(state.selected, state.clips.length - 1));
  renderTimeline(); seek(startOf(state.selected)); persist(); toast('Moment removed. Undo to bring it back.');
}
function trim() {
  const clip = state.clips[state.selected]; if (!clip) return;
  const start = Number($('clip-in').value), end = Number($('clip-out').value);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end - start < .25 || end > refFor(clip.ref).duration + .005) {
    renderSelection(); return toast('Choose a valid segment at least 0.25 seconds long.');
  }
  snapshot(); pause(); clip.in = start; clip.out = end;
  renderTimeline(); seek(startOf(state.selected)); persist();
}
function stopHover() {
  if (hoveredVideo) { hoveredVideo.pause(); hoveredVideo.removeAttribute('src'); hoveredVideo.load(); hoveredVideo.remove(); hoveredVideo = null; }
}
function hoverPreview(card, segment) {
  if (reducedMotion || state.playing || !matchMedia('(hover:hover)').matches) return;
  stopHover();
  const player = element('video'); player.muted = true; player.playsInline = true; player.preload = 'metadata';
  player.src = refFor(segment.ref).src; hoveredVideo = player;
  player.addEventListener('loadedmetadata', () => { if (hoveredVideo === player) { player.currentTime = segment.in; player.play().catch(() => {}); } });
  player.addEventListener('timeupdate', () => { if (player.currentTime >= segment.out) player.currentTime = segment.in; });
  card.querySelector('.segment-visual').append(player);
}
function openReference(segment, trigger) {
  stopHover(); pause(); state.dialogSegment = segment; dialogTrigger = trigger;
  const reference = refFor(segment.ref);
  $('dialog-title').textContent = reference.name;
  $('dialog-range').textContent = `${timecode(segment.in)} — ${timecode(segment.out)} · ${seconds(segment.out - segment.in)}`;
  const player = $('dialog-video'); player.src = reference.src; player.currentTime = segment.in;
  player.onloadedmetadata = () => { player.currentTime = segment.in; player.play().catch(() => {}); };
  $('reference-dialog').showModal();
}
function closeReference() {
  $('dialog-video').pause(); $('reference-dialog').close(); dialogTrigger?.focus();
}
function renderLibrary() {
  stopHover();
  const search = $('search').value.trim().toLowerCase();
  const references = state.references.filter(reference => `${reference.name} ${reference.originalName || ''}`.toLowerCase().includes(search));
  const tabs = $('reference-tabs'); tabs.replaceChildren();
  const all = element('button', `reference-tab${state.activeReference === 'all' ? ' active' : ''}`, 'All references');
  all.setAttribute('role', 'tab'); all.setAttribute('aria-selected', state.activeReference === 'all');
  all.tabIndex = state.activeReference === 'all' ? 0 : -1;
  all.addEventListener('click', () => chooseReference('all')); tabs.append(all);
  references.forEach(reference => {
    const tab = element('button', `reference-tab${state.activeReference === reference.id ? ' active' : ''}`);
    tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', state.activeReference === reference.id);
    tab.tabIndex = state.activeReference === reference.id ? 0 : -1;
    const image = element('img'); image.src = reference.poster; image.alt = ''; image.loading = 'lazy';
    tab.append(image, element('span', '', reference.name));
    tab.addEventListener('click', () => chooseReference(reference.id)); tabs.append(tab);
  });
  const active = state.activeReference === 'all' ? references : references.filter(reference => reference.id === state.activeReference);
  let segments;
  if (state.activeReference === 'all') {
    // Interleave videos so the first row shows a mix of creative directions.
    segments = [];
    for (let i = 0; i < Math.max(0, ...active.map(reference => reference.segments.length)); i++) for (const reference of active) if (reference.segments[i]) segments.push(reference.segments[i]);
  } else segments = active.flatMap(reference => reference.segments);
  $('source-title').textContent = state.activeReference === 'all' ? 'A world of different directions' : active[0]?.name || 'No matching references';
  $('source-detail').textContent = `${segments.length} moments · Hover to play · + to add`;
  const grid = $('segment-grid'); grid.replaceChildren();
  if (!segments.length) grid.append(element('div', 'library-empty', search ? 'No matching references. Try a different search.' : 'Your next idea starts with a reference. Add a video above.'));
  segments.forEach(segment => {
    const reference = refFor(segment.ref);
    const card = element('article', 'segment-card'); card.draggable = true;
    const visual = element('div', 'segment-visual');
    const image = element('img'); image.src = segment.poster || reference.poster; image.alt = ''; image.loading = 'lazy'; image.draggable = false;
    const preview = element('button', 'segment-preview'); preview.type = 'button'; preview.setAttribute('aria-label', `Preview ${reference.name}, part ${segment.part}`); preview.innerHTML = '<svg><use href="#i-play"/></svg>';
    preview.addEventListener('click', () => openReference(segment, preview));
    const add = element('button', 'segment-add'); add.type = 'button'; add.setAttribute('aria-label', `Add ${reference.name}, part ${segment.part} to film`); add.innerHTML = '<svg><use href="#i-plus"/></svg>';
    add.addEventListener('click', () => addSegment(segment, state.clips.length ? state.selected + 1 : 0));
    visual.append(image, preview, element('span', 'segment-number', `PART ${String(segment.part).padStart(2, '0')}`), element('span', 'segment-length', seconds(segment.out - segment.in)), add);
    const meta = element('div', 'segment-meta'); meta.append(element('span', '', reference.name.split(' · ')[0]), element('small', '', `${segment.in.toFixed(1)}—${segment.out.toFixed(1)}`));
    card.append(visual, meta, element('div', 'segment-subtitle', `${segment.part === 1 ? 'The opening' : segment.part === reference.segments.length ? 'The closing moment' : 'The story unfolds'} · Reference footage`));
    card.addEventListener('mouseenter', () => hoverPreview(card, segment)); card.addEventListener('mouseleave', stopHover);
    card.addEventListener('dragstart', event => { stopHover(); state.dragged = { type: 'segment', segment }; event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('text/plain', reference.name); });
    card.addEventListener('dragend', () => { state.dragged = null; });
    grid.append(card);
  });
  $('library-count').textContent = `${state.references.length} videos · ${state.references.reduce((sum, reference) => sum + reference.segments.length, 0)} moments`;
}
function chooseReference(id) {
  state.activeReference = id; renderLibrary();
  $('reference-tabs').querySelector('[aria-selected="true"]')?.focus({ preventScroll: true });
}
$('reference-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...$('reference-tabs').querySelectorAll('[role="tab"]')];
  const index = tabs.indexOf(event.target); if (index < 0) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].click();
  $('reference-tabs').querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
});
$('clips-track').addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = state.dragged?.type === 'clip' ? 'move' : 'copy'; });
$('clips-track').addEventListener('drop', event => {
  event.preventDefault();
  const target = event.target.closest('.timeline-clip');
  const index = target ? Number(target.dataset.index) : state.clips.length;
  if (state.dragged?.type === 'segment') addSegment(state.dragged.segment, index);
  else if (state.dragged?.type === 'clip') reorder(state.dragged.index, Math.min(index, state.clips.length - 1));
  state.dragged = null;
});
for (const id of ['play', 'play-top']) $(id).addEventListener('click', togglePlay);
$('restart').addEventListener('click', () => { pause(); seek(0); });
$('scrubber').addEventListener('input', () => { pause(); seek(Number($('scrubber').value)); });
$('mute').addEventListener('click', () => { video.muted = !video.muted; $('mute').setAttribute('aria-pressed', video.muted); $('mute').setAttribute('aria-label', video.muted ? 'Unmute reference audio' : 'Mute reference audio'); document.querySelector('.mute-slash').hidden = !video.muted; });
$('fullscreen').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else $('canvas-wrap').requestFullscreen?.().catch(() => toast('Fullscreen is unavailable in this browser.')); });
$('present').addEventListener('click', () => { document.body.classList.add('present-mode'); toast('Presentation view · press Esc to exit'); });
$('undo').addEventListener('click', () => restoreHistory('undo')); $('redo').addEventListener('click', () => restoreHistory('redo'));
$('reset-demo').addEventListener('click', loadDemo);
$('remove-clip').addEventListener('click', removeClip);
$('move-left').addEventListener('click', () => reorder(state.selected, state.selected - 1)); $('move-right').addEventListener('click', () => reorder(state.selected, state.selected + 1));
$('clip-in').addEventListener('change', trim); $('clip-out').addEventListener('change', trim);
$('brand-name').addEventListener('input', brand); $('brand-message').addEventListener('input', brand);
$('aspect').addEventListener('change', setAspect);
document.querySelectorAll('.swatch').forEach(button => button.addEventListener('click', () => palette(button.dataset.accent, button.dataset.paper)));
$('custom-color').addEventListener('input', event => palette(event.target.value, '#eef0e6'));
$('search').addEventListener('input', () => { state.activeReference = 'all'; renderLibrary(); });
$('rail-references').addEventListener('click', () => $('library-panel').scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' }));
$('rail-brand').addEventListener('click', () => { $('brand-panel').scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' }); $('brand-name').focus({ preventScroll: true }); });
for (const mode of ['concept', 'reference']) $(`mode-${mode}`).addEventListener('click', () => {
  state.mode = mode; $('canvas-wrap').classList.toggle('reference-mode', mode === 'reference');
  for (const option of ['concept', 'reference']) { $(`mode-${option}`).classList.toggle('active', option === mode); $(`mode-${option}`).setAttribute('aria-pressed', option === mode); }
  $('canvas-label').textContent = mode === 'concept' ? 'CONCEPT PREVIEW' : 'ORIGINAL REFERENCE';
});
$('close-dialog').addEventListener('click', closeReference);
$('reference-dialog').addEventListener('close', () => { $('dialog-video').pause(); dialogTrigger?.focus(); });
$('dialog-video').addEventListener('timeupdate', () => { if (state.dialogSegment && $('dialog-video').currentTime >= state.dialogSegment.out) $('dialog-video').pause(); });
$('dialog-add').addEventListener('click', () => { addSegment(state.dialogSegment, state.clips.length ? state.selected + 1 : 0); closeReference(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') document.body.classList.remove('present-mode');
  if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || $('reference-dialog').open) return;
  if (event.code === 'Space' && !event.target.closest('button,a')) { event.preventDefault(); togglePlay(); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); restoreHistory(event.shiftKey ? 'redo' : 'undo'); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); stopHover(); $('dialog-video').pause(); } });
$('upload').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  const src = URL.createObjectURL(file); const player = document.createElement('video'); player.muted = true; player.preload = 'metadata'; player.src = src;
  try {
    await new Promise((resolve, reject) => { player.onloadedmetadata = resolve; player.onerror = reject; });
    if (!Number.isFinite(player.duration) || player.duration < .25) throw new Error('duration');
    const id = `upload-${Date.now()}`;
    player.currentTime = Math.min(.25, player.duration / 2);
    await new Promise((resolve, reject) => { player.onseeked = resolve; player.onerror = reject; });
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = Math.max(1, Math.round(480 * player.videoHeight / player.videoWidth));
    canvas.getContext('2d').drawImage(player, 0, 0, canvas.width, canvas.height);
    const poster = canvas.toDataURL('image/jpeg', .7);
    const reference = { id, name: file.name.replace(/\.[^.]+$/, ''), duration: player.duration, src, poster, uploaded: true };
    reference.segments = splitReference(reference).map(segment => ({ ...segment, poster }));
    state.references.unshift(reference); state.activeReference = id; renderLibrary(); toast('Video added for this session. Pick your favorite moments.');
  } catch { URL.revokeObjectURL(src); toast('This video could not be opened. Try an MP4 file.'); }
  finally { player.removeAttribute('src'); player.load(); event.target.value = ''; }
});
async function initialize() {
  try {
    const response = await fetch('/api/references'); if (!response.ok) throw new Error('library');
    const data = await response.json(); state.references = data.references || [];
    let saved;
    try { saved = JSON.parse(localStorage.getItem(STORAGE) || 'null'); } catch { saved = null; }
    if (saved) {
      state.clips = Array.isArray(saved.clips) ? saved.clips.filter(clip => refFor(clip.ref) && Number.isFinite(clip.in) && Number.isFinite(clip.out) && clip.in >= 0 && clip.out > clip.in && clip.out <= refFor(clip.ref).duration + .005).slice(0, 24) : [];
      if (typeof saved.brand === 'string') $('brand-name').value = saved.brand.slice(0, 30);
      if (typeof saved.message === 'string') $('brand-message').value = saved.message.slice(0, 80);
      if (/^#[a-f\d]{6}$/i.test(saved.accent) && /^#[a-f\d]{6}$/i.test(saved.paper)) palette(saved.accent, saved.paper);
      if (['landscape', 'portrait', 'square'].includes(saved.aspect)) $('aspect').value = saved.aspect;
    } else state.clips = demoClips();
    state.initialized = true;
    renderLibrary(); brand(); setAspect(); renderTimeline(); seek(0);
  } catch {
    $('segment-grid').replaceChildren(element('div', 'library-empty', 'The reference library could not load. Reload to try again.'));
    $('library-count').textContent = 'Library unavailable'; toast('Could not load references.');
  }
}
initialize();
