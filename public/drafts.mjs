// Super-simple HyperFrames drafts. A draft is a 640×360 HTML scene driven by a paused GSAP
// timeline. Each section of a reference is described by one or two "beats" — [kind, text,
// options] — and every kind is a deliberately basic layout: flat shapes, plain type, one
// entrance and a slow drift.
const W = 640, H = 360;

function el(parent, css, text) {
  const node = document.createElement('div');
  node.style.cssText = 'position:absolute;' + css;
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
}
const center = 'left:50%;top:50%;transform:translate(-50%,-50%);';
const fontFor = text => text.length < 8 ? 84 : text.length < 16 ? 50 : text.length < 28 ? 36 : 28;
const bars = (parent, count, css, color) => Array.from({ length: count }, (_, i) =>
  el(parent, `left:0;top:${i * 18}px;height:8px;border-radius:4px;width:${[100, 82, 64, 90, 70][i % 5]}%;background:${color};`)).map((bar, i, all) => (bar.style.position = 'absolute', bar));
function drift(tl, target, span, amount = .04) { tl.fromTo(target, { scale: 1 }, { scale: 1 + amount, duration: span, ease: 'none' }, 0); }

function words(parent, text, size, c, css = '', weight = size >= 64 ? 700 : 400) {
  const row = el(parent, `${center}width:580px;display:flex;flex-wrap:wrap;justify-content:center;gap:0 .26em;font-size:${size}px;line-height:1.1;font-weight:${weight};letter-spacing:${size >= 64 ? '-.03em' : '0'};text-align:center;${css}`);
  for (const word of text.split(' ')) {
    const span = document.createElement('span');
    span.textContent = word; span.style.display = 'inline-block';
    row.append(span);
  }
  return row;
}
const placed = o => o.x !== undefined || o.y !== undefined ? `left:${(o.x ?? .5) * W}px;top:${(o.y ?? .5) * H}px;` : '';

const KINDS = {
  text(b, t, o, c, tl, span) {
    const row = words(b, t, o.size || fontFor(t), c, placed(o), o.weight);
    tl.from(row.children, { y: 24, opacity: 0, stagger: .09, duration: .45, ease: 'power3.out' }, 0);
    drift(tl, row, span);
  },
  logo(b, t, o, c, tl, span) {
    const group = el(b, `${center}display:flex;align-items:center;gap:18px;white-space:nowrap`);
    const mark = o.mark ? el(group, `position:relative;font-size:${o.markSize || 56}px;line-height:1;font-weight:700`, o.mark)
      : el(group, `position:relative;width:48px;height:48px;border-radius:12px;background:${c.fg};flex:none`);
    const word = el(group, `position:relative;font-size:${o.size || (t.length > 10 ? 36 : 48)}px;font-weight:700;letter-spacing:-.02em`, t);
    tl.from(mark, { scale: 0, rotation: -40, duration: .55, ease: 'back.out(1.8)' }, 0);
    tl.fromTo(word, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: .6, ease: 'power2.out' }, .3);
    if (o.sub) {
      const sub = el(b, `left:0;right:0;top:${H / 2 + 50}px;text-align:center;font-size:18px;color:${c.muted}`, o.sub);
      tl.from(sub, { opacity: 0, y: 8, duration: .4 }, .8);
    }
    drift(tl, group, span, .03);
  },
  input(b, t, o, c, tl, span) {
    if (o.h) { const title = el(b, `left:0;right:0;top:64px;text-align:center;font-size:32px;font-weight:700`, o.h); tl.from(title, { opacity: 0, y: 12, duration: .4 }, 0); }
    const box = el(b, `left:100px;top:${o.h ? 130 : 130}px;width:440px;height:100px;border-radius:18px;border:2px solid ${c.line};background:${c.card}`);
    const typed = el(box, `left:22px;top:20px;right:60px;font-size:20px;white-space:nowrap;overflow:hidden`, t);
    el(box, `left:22px;bottom:16px;font-size:22px;color:${c.muted}`, '+');
    const send = el(box, `right:16px;bottom:14px;width:30px;height:30px;border-radius:50%;background:${c.accent}`);
    tl.from(box, { opacity: 0, y: 20, duration: .4, ease: 'power2.out' }, .1);
    tl.fromTo(typed, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: Math.min(1.6, span * .5), ease: `steps(${Math.max(4, t.length)})` }, .4);
    tl.to(send, { scale: 1.25, duration: .15, yoyo: true, repeat: 1 }, Math.min(2.1, span * .7));
  },
  chat(b, t, o, c, tl, span) {
    const bubble = el(b, `right:70px;top:70px;max-width:360px;padding:16px 20px;border-radius:18px 18px 4px 18px;background:${c.accent};color:${c.onAccent};font-size:20px;line-height:1.3`, t);
    const reply = el(b, 'left:70px;top:200px;width:380px;height:80px');
    el(reply, `left:0;top:0;width:34px;height:34px;border-radius:50%;background:${c.muted}`);
    const lines = el(reply, 'left:50px;top:6px;right:0;height:60px');
    const rows = bars(lines, 3, '', c.line);
    tl.from(bubble, { opacity: 0, y: 16, scale: .95, duration: .4, ease: 'power2.out' }, .1);
    tl.from(reply, { opacity: 0, duration: .3 }, .7);
    tl.from(rows, { width: 0, stagger: .15, duration: .5 }, .8);
  },
  window(b, t, o, c, tl, span) {
    const win = el(b, `left:90px;top:44px;width:460px;height:272px;border-radius:14px;border:2px solid ${c.line};background:${c.card};overflow:hidden`);
    [0, 1, 2].forEach(i => el(win, `left:${14 + i * 14}px;top:12px;width:8px;height:8px;border-radius:50%;background:${c.line}`));
    el(win, 'left:0;right:0;top:32px;height:2px;background:' + c.line);
    const side = el(win, `left:14px;top:48px;width:70px;bottom:14px`); bars(side, 6, '', c.line);
    const title = el(win, `left:100px;top:46px;right:16px;font-size:${t.length > 24 ? 16 : 20}px;font-weight:700;white-space:nowrap;overflow:hidden`, t);
    const tiles = [0, 1, 2].map(i => el(win, `left:${100 + i * 116}px;top:86px;width:104px;height:60px;border-radius:8px;background:${c.fill};border:1.5px solid ${c.line}`));
    const block = el(win, `left:100px;top:160px;right:16px;bottom:16px;border-radius:8px;background:${c.fill};border:1.5px solid ${c.line}`);
    const pointer = el(b, `left:470px;top:300px;width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:20px solid ${c.fg};transform:rotate(-25deg)`);
    tl.from(win, { opacity: 0, y: 30, scale: .95, duration: .5, ease: 'power3.out' }, 0);
    tl.from([title, ...tiles, block], { opacity: 0, y: 8, stagger: .08, duration: .3 }, .35);
    tl.fromTo(pointer, { x: 0, y: 0 }, { x: -260, y: -150, duration: span * .8, ease: 'sine.inOut' }, .3);
  },
  phone(b, t, o, c, tl, span) {
    const stacked = o.stack && t;
    const phone = el(b, `left:${stacked || !t ? 245 : 110}px;top:${stacked ? 96 : 34}px;width:150px;height:292px;border-radius:28px;border:3px solid ${c.fg};background:${c.card};overflow:hidden`);
    el(phone, `left:50px;top:10px;width:44px;height:10px;border-radius:5px;background:${c.fg}`);
    const rows = [0, 1, 2, 3, 4].map(i => el(phone, `left:12px;right:12px;top:${40 + i * 48}px;height:38px;border-radius:9px;background:${i === 1 ? c.fg : c.fill}`));
    tl.from(phone, { y: 80, opacity: 0, duration: .55, ease: 'power3.out' }, 0);
    tl.from(rows, { opacity: 0, x: -10, stagger: .08, duration: .3 }, .4);
    if (stacked) {
      const caption = words(b, t, 28, c, 'top:56px', 700);
      tl.from(caption.children, { opacity: 0, y: 10, stagger: .08, duration: .35 }, .2);
    } else if (t) {
      const caption = words(b, t, t.length > 20 ? 28 : 36, c, 'left:300px;transform:translateY(-50%);width:300px;justify-content:flex-start;text-align:left');
      tl.from(caption.children, { opacity: 0, y: 14, stagger: .08, duration: .35 }, .5);
    }
    drift(tl, phone, span, .03);
  },
  cards(b, t, o, c, tl, span) {
    const top = t ? 104 : 70;
    if (t) { const title = el(b, `left:0;right:0;top:40px;text-align:center;font-size:30px;font-weight:700`, t); tl.from(title, { opacity: 0, y: 10, duration: .4 }, 0); }
    const tiles = Array.from({ length: 6 }, (_, i) => el(b, `left:${95 + (i % 3) * 154}px;top:${top + Math.floor(i / 3) * 112}px;width:142px;height:98px;border-radius:12px;background:${i % 2 ? c.card : c.fill};border:1.5px solid ${c.line}`));
    tl.from(tiles, { scale: 0, opacity: 0, stagger: .07, duration: .4, ease: 'back.out(1.6)' }, .2);
    drift(tl, tiles, span, .03);
  },
  list(b, t, o, c, tl, span) {
    const items = t.split('|');
    const box = el(b, `left:110px;top:${180 - items.length * 30}px;width:420px`);
    items.forEach((item, i) => {
      const row = el(box, `left:0;top:${i * 60}px;right:0;height:44px;display:flex;align-items:center;gap:16px;font-size:22px;font-weight:600`);
      const dot = el(row, `position:relative;width:26px;height:26px;border-radius:50%;border:3px solid ${c.fg};flex:none`);
      row.append(item);
      tl.from(row, { opacity: 0, x: -16, duration: .35 }, .15 + i * .15);
      tl.to(dot, { backgroundColor: c.accent, borderColor: c.accent, duration: .2 }, .9 + i * Math.min(.6, span / 6));
    });
  },
  chart(b, t, o, c, tl, span) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.style.cssText = 'position:absolute;left:0;top:0';
    const axis = document.createElementNS(svgNS, 'path'); axis.setAttribute('d', 'M80 60 V300 H560'); axis.setAttribute('stroke', c.line); axis.setAttribute('stroke-width', '3'); axis.setAttribute('fill', 'none');
    const line = document.createElementNS(svgNS, 'path'); line.setAttribute('d', 'M90 270 C170 250 200 200 260 210 S360 120 420 140 S500 80 550 70');
    line.setAttribute('stroke', c.accent); line.setAttribute('stroke-width', '6'); line.setAttribute('fill', 'none'); line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-dasharray', '700'); line.setAttribute('stroke-dashoffset', '700');
    svg.append(axis, line); b.append(svg);
    tl.to(line, { attr: { 'stroke-dashoffset': 0 }, duration: Math.min(2, span * .7), ease: 'power2.inOut' }, .2);
    if (t) { const tag = el(b, `left:380px;top:170px;padding:10px 18px;border-radius:12px;background:${c.card};border:2px solid ${c.line};font-size:24px;font-weight:700`, t); tl.from(tag, { opacity: 0, scale: .8, duration: .35 }, .9); }
  },
  notify(b, t, o, c, tl, span) {
    const pill = el(b, `left:110px;top:130px;width:420px;height:84px;border-radius:22px;background:${c.card};border:2px solid ${c.line};display:flex;align-items:center;gap:16px;padding:0 18px;box-sizing:border-box`);
    el(pill, `position:relative;width:46px;height:46px;border-radius:12px;background:${c.accent};flex:none`);
    el(pill, 'position:relative;font-size:20px;font-weight:700;white-space:nowrap;overflow:hidden', t);
    tl.from(pill, { y: -160, duration: .6, ease: 'back.out(1.3)' }, .1);
    drift(tl, pill, span, .03);
  },
  icons(b, t, o, c, tl, span) {
    const dots = Array.from({ length: 15 }, (_, i) => el(b, `left:${140 + (i % 5) * 80}px;top:${70 + Math.floor(i / 5) * 80}px;width:56px;height:56px;border-radius:${i % 2 ? 50 : 14}%;background:${i % 3 ? c.fill : c.fg};border:1.5px solid ${c.line}`));
    tl.from(dots, { scale: 0, duration: .4, stagger: { each: .04, from: 'center' }, ease: 'back.out(2)' }, 0);
    tl.to(b, { rotation: 4, duration: span, ease: 'none' }, 0);
  },
  hub(b, t, o, c, tl, span) {
    const core = el(b, `${center}width:96px;height:96px;border-radius:26px;background:${c.accent}`);
    const pills = [[120, 80], [430, 90], [110, 250], [420, 250]].map(([x, y], i) => el(b, `left:${x}px;top:${y}px;width:110px;height:36px;border-radius:18px;background:${c.card};border:1.5px solid ${c.fg}`));
    tl.from(core, { scale: 0, duration: .5, ease: 'back.out(2)' }, 0);
    tl.from(pills, { opacity: 0, x: (i) => i % 2 ? 60 : -60, stagger: .1, duration: .45 }, .3);
    tl.to(pills, { y: (i) => i < 2 ? 12 : -12, duration: span, ease: 'sine.inOut' }, .3);
    if (t) { const label = el(b, `left:0;right:0;top:${H / 2 + 70}px;text-align:center;font-size:24px;font-weight:700`, t); tl.from(label, { opacity: 0, duration: .3 }, .6); }
  },
  cloud(b, t, o, c, tl, span) {
    const [main, ...rest] = t.split('|');
    const spots = [[.3, .2], [.66, .3], [.34, .36], [.8, .54], [.2, .66], [.66, .8], [.5, .88]];
    const small = rest.map((word, i) => el(b, `left:${spots[i % spots.length][0] * W}px;top:${spots[i % spots.length][1] * H}px;transform:translate(-50%,-50%);font-size:${i === rest.length - 1 ? 30 : 18}px;color:${c.muted};white-space:nowrap`, word));
    const hero = el(b, `${center}font-size:52px;font-weight:700;letter-spacing:-.02em;white-space:nowrap`, main);
    tl.from(hero, { opacity: 0, scale: .9, duration: .5, ease: 'power3.out' }, 0);
    tl.from(small, { opacity: 0, stagger: .1, duration: .4 }, .3);
    tl.to(small, { y: (i) => i % 2 ? -10 : 10, duration: span, ease: 'sine.inOut' }, .3);
  },
  collage(b, t, o, c, tl, span) {
    const spots = [[70, 40, 90, 70], [460, 30, 100, 80], [60, 230, 110, 80], [470, 220, 90, 90], [260, 250, 80, 60]];
    const photos = spots.map(([x, y, w, h], i) => el(b, `left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:8px;background:${c.fill};border:1.5px solid ${c.line}`));
    const row = words(b, t, 34, c);
    tl.from(photos, { scale: 0, rotation: (i) => i % 2 ? 12 : -12, stagger: .08, duration: .45, ease: 'back.out(1.6)' }, 0);
    tl.from(row.children, { opacity: 0, y: 14, stagger: .08, duration: .35 }, .4);
    tl.to(photos, { y: (i) => i % 2 ? -10 : 10, duration: span, ease: 'sine.inOut' }, .4);
  },
  logos(b, t, o, c, tl, span) {
    const rows = [0, 1, 2].map(r => {
      const strip = el(b, `left:-60px;top:${60 + r * 90}px;display:flex;gap:16px`);
      for (let i = 0; i < 6; i++) el(strip, `position:relative;width:140px;height:62px;border-radius:14px;background:${(i + r) % 3 ? c.card : c.fill};border:1.5px solid ${c.line}`);
      return strip;
    });
    tl.from(rows, { opacity: 0, duration: .3, stagger: .08 }, 0);
    tl.to(rows, { x: (i) => i % 2 ? -120 : 90, duration: span, ease: 'none' }, 0);
  },
  // A hero object: a flat tile that drops in tilted, settles, then turns slowly in 3D
  // while a highlight sweeps across it.
  shape(b, t, o, c, tl, span) {
    const stage = el(b, `left:${t ? 150 : 250}px;top:110px;width:140px;height:140px;perspective:600px`);
    const tile = el(stage, `left:0;top:0;width:140px;height:140px;border-radius:32px;background:${c.fill};border:2px solid ${c.fg};overflow:hidden;box-sizing:border-box`);
    el(tile, `left:36px;top:36px;width:64px;height:64px;border-radius:16px;background:${c.fg}`);
    const shine = el(tile, `left:-80px;top:-20px;width:40px;height:200px;background:${c.bg};opacity:.35;transform:rotate(20deg)`);
    const shadow = el(b, `left:${t ? 160 : 260}px;top:278px;width:120px;height:8px;border-radius:50%;background:${c.line}`);
    tl.fromTo(tile, { y: -60, opacity: 0, rotationX: 50, rotationZ: -12 }, { y: 0, opacity: 1, rotationX: 0, rotationZ: 0, duration: .8, ease: 'back.out(1.4)' }, 0);
    tl.from(shadow, { scaleX: .3, opacity: 0, duration: .8, ease: 'power2.out' }, 0);
    tl.to(tile, { rotationY: 28, rotationX: -8, duration: Math.max(1, span - .8), ease: 'sine.inOut' }, .8);
    tl.fromTo(shine, { x: 0 }, { x: 260, duration: 1.1, ease: 'power2.inOut' }, .7);
    if (t) { const caption = words(b, t, 40, c, 'left:340px;transform:translateY(-50%);width:270px;justify-content:flex-start;text-align:left'); tl.from(caption.children, { opacity: 0, y: 12, stagger: .08, duration: .35 }, .4); }
  },
  burst(b, t, o, c, tl, span) {
    const line = el(b, `left:0;right:0;top:${H / 2 - 1}px;height:3px;background:${c.fg};transform:scaleX(0)`);
    const star = el(b, `${center}width:60px;height:60px`);
    [0, 45].forEach(r => el(star, `left:0;top:0;width:60px;height:60px;background:${c.accent};transform:rotate(${r}deg) scale(.7);border-radius:6px`));
    tl.to(line, { scaleX: 1, duration: .7, ease: 'power2.out' }, 0);
    tl.from(star, { scale: 0, rotation: -90, duration: .6, ease: 'back.out(2)' }, .2);
    tl.to(star, { rotation: 90, duration: span, ease: 'none' }, .8);
    if (t) { const label = el(b, `left:0;right:0;top:${H / 2 + 50}px;text-align:center;font-size:26px;font-weight:700`, t); tl.from(label, { opacity: 0, duration: .3 }, .6); }
  },
  grid(b, t, o, c, tl, span) {
    const cells = (o.cells || t.split('|')).slice(0, 4);
    const tiles = cells.map((cell, i) => {
      const tile = el(b, `left:${i % 2 ? 324 : 12}px;top:${i < 2 ? 12 : 184}px;width:304px;height:164px;border-radius:12px;background:${cell ? c.card : c.fill};border:1.5px solid ${c.line};display:grid;place-items:center;text-align:center;font-size:20px;font-weight:400;padding:0 18px;box-sizing:border-box`, cell);
      return tile;
    });
    tl.from(tiles, { opacity: 0, scale: .9, stagger: .12, duration: .4, ease: 'power2.out' }, 0);
    drift(tl, tiles, span, .02);
  },
  split(b, t, o, c, tl, span) {
    const panel = el(b, `left:0;top:0;bottom:0;width:300px;background:${c.accent};color:${c.onAccent};display:flex;align-items:center;padding:0 30px;box-sizing:border-box;font-size:28px;font-weight:400;line-height:1.2`, t);
    const side = el(b, 'left:340px;top:90px;width:250px;height:180px'); const rows = bars(side, 9, '', c.line);
    tl.from(panel, { xPercent: -100, duration: .55, ease: 'power3.out' }, 0);
    tl.from(rows, { width: 0, stagger: .05, duration: .35 }, .4);
  },
  face(b, t, o, c, tl, span) {
    const blob = el(b, `left:${t ? 120 : 230}px;top:90px;width:180px;height:180px;border-radius:50%;background:${c.accent}`);
    const eyes = [60, 100].map(x => el(blob, `left:${x}px;top:80px;width:22px;height:30px;border-radius:50%;background:${c.bg}`));
    tl.from(blob, { scale: 0, duration: .55, ease: 'back.out(1.8)' }, 0);
    tl.to(eyes, { scaleY: .1, duration: .08, yoyo: true, repeat: 1 }, Math.min(1.4, span * .5));
    tl.to(blob, { y: -14, duration: span / 2, yoyo: true, repeat: 1, ease: 'sine.inOut' }, .5);
    if (t) { const caption = words(b, t, 40, c, 'left:340px;transform:translateY(-50%);width:270px;justify-content:flex-start;text-align:left'); tl.from(caption.children, { opacity: 0, y: 12, stagger: .08, duration: .35 }, .4); }
  }
};

const luminance = hex => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * .3 + ((n >> 8) & 255) * .59 + (n & 255) * .11) / 255; };
// Drafts are strictly black and white: only whether a frame is light or dark is kept from
// the finished film; every colour becomes black, white or a grey.
function colors(palette, override = {}) {
  let dark = luminance(palette.bg || '#ffffff') < .5;
  if (override.bg === 'accent') dark = !dark;
  else if (override.bg) dark = luminance(override.bg) < .5;
  return dark
    ? { bg: '#000000', fg: '#ffffff', accent: '#ffffff', onAccent: '#000000', card: '#0d0d0d', line: '#3a3a3a', muted: '#8c8c8c', fill: '#262626' }
    : { bg: '#ffffff', fg: '#000000', accent: '#000000', onAccent: '#ffffff', card: '#ffffff', line: '#d0d0d0', muted: '#7a7a7a', fill: '#ececec' };
}

// `starts` optionally gives each beat's start (seconds into the section), so a draft can
// switch beats exactly where the finished film cuts; otherwise beats share the time evenly.
export function buildDraft(root, beats, duration, palette = {}, starts = beats.map((_, i) => duration * i / beats.length)) {
  const base = colors(palette);
  root.style.cssText += `;background:${base.bg};color:${base.fg};font-family:Arial,Helvetica,sans-serif;overflow:hidden`;
  const tl = gsap.timeline({ paused: true });
  beats.forEach(([kind, text = '', options = {}], index) => {
    const begin = starts[index], span = (starts[index + 1] ?? duration) - begin;
    const c = colors(palette, options);
    const beat = el(root, `left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;background:${c.bg};color:${c.fg}`);
    const local = gsap.timeline();
    (KINDS[kind] || KINDS.text)(beat, text, options, c, local, span);
    if (local.duration() < span) local.to({}, { duration: span - local.duration() });
    tl.add(local, begin);
    if (index) { gsap.set(beat, { autoAlpha: 0 }); tl.set(beat, { autoAlpha: 1 }, begin); }
    if (index < beats.length - 1) tl.set(beat, { autoAlpha: 0 }, begin + span);
  });
  if (tl.duration() < duration) tl.to({}, { duration: duration - tl.duration() });
  return tl;
}
