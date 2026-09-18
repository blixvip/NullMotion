// Six rough HyperFrames-style drafts, one per section of the Interface (Replit) reference.
// Each is a 640×360 HTML scene driven by a paused GSAP timeline, so the page can seek it
// to any local time. They are deliberately crude: placeholder bars, flat blocks, plain type.
const ORANGE = '#000000', INK = '#000000', PINK = '#e6e6e6', GREY = '#d0d0d0', LILAC = '#ececec';

function box(parent, css, text) {
  const node = document.createElement('div');
  node.style.cssText = 'position:absolute;' + css;
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
}
function paper(root) {
  root.style.cssText += `;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:${INK}`;
}
const words = (parent, css, list) => list.map(([text, style = '']) => box(parent, `position:relative;display:inline-block;${style}`, text))
  .reduce((row, word) => (row.append(word), row), box(parent, `display:flex;gap:10px;align-items:center;white-space:nowrap;${css}`));
const bar = (parent, css) => box(parent, `height:8px;border-radius:4px;background:${GREY};${css}`);
function dashboard(parent, css) {
  const win = box(parent, `background:#fff;border:2px solid ${GREY};border-radius:10px;overflow:hidden;${css}`);
  bar(win, 'left:14px;top:14px;width:120px;');
  bar(win, 'left:14px;top:30px;width:70px;height:6px;');
  const cards = [0, 1, 2, 3].map(i => box(win, `left:calc(14px + ${i * 24}%);top:56px;width:calc(24% - 12px);height:40px;border-radius:6px;background:${LILAC};`));
  const chart = box(win, `left:14px;top:108px;right:34%;bottom:14px;border-radius:6px;background:${LILAC};opacity:.8`);
  const side = box(win, `right:14px;top:108px;width:28%;bottom:14px;border-radius:6px;background:${LILAC};opacity:.6`);
  return { win, cards, chart, side };
}
function cursor(parent, color, css) {
  const node = box(parent, `width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-bottom:22px solid ${color};transform:rotate(-20deg);${css}`);
  return node;
}

const scenes = [
  { name: 'Intro', build(root, tl) {
    const line = words(root, 'left:50%;top:50%;transform:translate(-50%,-50%);font-size:52px;', [['Now'], ['everyone'], ['■', `color:${ORANGE};font-size:44px`], ['can build']]);
    tl.from(line.children, { y: 18, opacity: 0, stagger: .22, duration: .4, ease: 'power3.out' }, 0);
    tl.to(line, { opacity: 0, scale: .8, duration: .3 }, 1.45);
    const grid = box(root, 'left:50%;top:50%;width:300px;height:190px;transform:translate(-50%,-50%) scale(1.45)');
    const tiles = [
      box(grid, `left:0;top:0;width:170px;height:80px;border-radius:14px;background:${INK};color:#fff;font-size:30px;display:grid;place-items:center`, 'safely'),
      box(grid, `left:182px;top:0;width:80px;height:80px;border-radius:14px;background:${ORANGE}`),
      box(grid, `left:0;top:92px;width:80px;height:92px;border-radius:14px;border:2px dashed ${GREY};background:#fff`),
      box(grid, `left:92px;top:100px;width:90px;height:80px;border-radius:14px;background:${ORANGE}`),
      box(grid, `left:194px;top:96px;width:88px;height:88px;border-radius:50%;border:2px solid ${INK};background:#fff`)
    ];
    tl.from(tiles, { scale: 0, opacity: 0, stagger: .1, duration: .45, ease: 'back.out(1.6)' }, 1.6);
  } },
  { name: 'Logo', build(root, tl) {
    const mark = box(root, 'left:50%;top:50%;width:150px;height:150px;transform:translate(-50%,-50%)');
    [['0', '0'], ['50px', '50px'], ['0', '100px']].forEach(([left, top]) => box(mark, `left:${left};top:${top};width:62px;height:50px;border-radius:12px;background:${ORANGE}`));
    tl.from(mark, { scale: 1.8, duration: .8, ease: 'power3.out' }, 0);
    tl.to(mark, { scale: .55, x: -120, duration: .6, ease: 'power3.inOut' }, 1);
    const word = box(root, 'left:262px;top:140px;font-size:72px;overflow:hidden;white-space:nowrap;width:0', 'Replit');
    tl.to(word, { width: 230, duration: .6, ease: 'steps(6)' }, 1.5);
    const tag = box(root, 'left:150px;top:250px;display:flex;gap:8px;align-items:center');
    bar(tag, 'position:relative;width:60px'); bar(tag, `position:relative;width:70px;background:${ORANGE}`); bar(tag, 'position:relative;width:170px');
    tl.from(tag, { opacity: 0, y: 10, duration: .4 }, 2.05);
  } },
  { name: 'Prompt', build(root, tl) {
    const title = box(root, 'left:0;right:0;top:70px;text-align:center;font-size:48px', 'What will you build?');
    tl.from(title, { opacity: 0, y: 14, duration: .4 }, 0);
    const input = box(root, `left:100px;top:150px;width:440px;height:110px;border:2px solid ${PINK};border-radius:12px;background:#fff`);
    const typed = bar(input, 'left:20px;top:22px;width:0;height:12px;border-radius:6px;background:#bdbdbd');
    box(input, `right:16px;bottom:16px;width:22px;height:22px;border-radius:50%;background:${ORANGE}`);
    tl.from(input, { opacity: 0, scaleX: .8, duration: .4 }, .25);
    tl.to(typed, { width: 340, duration: 1.3, ease: 'steps(18)' }, .6);
    tl.to([title, input], { opacity: 0, y: -20, duration: .3 }, 2.1);
    const line = box(root, `left:120px;top:270px;width:0;height:4px;background:${ORANGE}`);
    const button = box(root, `left:255px;top:115px;width:130px;height:130px;border-radius:50%;background:${ORANGE};color:#fff;font-size:60px;display:grid;place-items:center`, '→');
    tl.from(button, { scale: 0, duration: .4, ease: 'back.out(2)' }, 2.25);
    tl.to(line, { width: 400, duration: .6, ease: 'power2.out' }, 2.4);
  } },
  { name: 'Build', build(root, tl) {
    const bubble = box(root, `left:300px;top:50px;width:280px;height:70px;border-radius:14px;background:${PINK}`);
    bar(bubble, 'left:18px;top:18px;width:230px;height:12px;border-radius:6px;background:#c4c4c4'); bar(bubble, 'left:18px;top:40px;width:150px;height:12px;border-radius:6px;background:#c4c4c4');
    const working = box(root, 'left:90px;top:160px;display:flex;align-items:center;gap:14px;font-size:34px;color:#7a7a7a');
    box(working, `position:relative;width:34px;height:34px;border-radius:8px;background:${ORANGE}`); working.append('working…');
    tl.from(bubble, { opacity: 0, x: 30, duration: .4 }, 0);
    tl.from(working, { opacity: 0, duration: .3 }, .4);
    tl.to(working.firstChild, { rotation: 360, duration: .8, repeat: 1 }, .4);
    const { win, cards, chart, side } = dashboard(root, 'left:110px;top:120px;width:420px;height:210px');
    tl.from(win, { opacity: 0, scale: .4, y: 60, duration: .7, ease: 'power3.out' }, 1.4);
    tl.to([bubble, working], { opacity: 0, duration: .3 }, 1.4);
    tl.to(win, { left: 20, top: 20, width: 600, height: 320, duration: .7, ease: 'power2.inOut' }, 2.4);
    tl.from([...cards, chart, side], { opacity: 0, y: 10, stagger: .08, duration: .3 }, 1.9);
  } },
  { name: 'Team', build(root, tl) {
    const line = words(root, 'left:50%;top:120px;transform:translateX(-50%);font-size:50px', [['Build'], ['with'], ['your'], ['team']]);
    tl.from(line.children, { opacity: 0, y: 12, stagger: .15, duration: .35 }, 0);
    const { win } = dashboard(root, 'left:40px;top:30px;width:560px;height:300px');
    const cursors = [cursor(root, INK, 'left:110px;top:250px;scale:1.8'), cursor(root, INK, 'left:310px;top:250px;scale:1.8'), cursor(root, INK, 'left:510px;top:240px;scale:1.8')];
    tl.from(cursors, { opacity: 0, y: 40, stagger: .12, duration: .4 }, .5);
    tl.to(cursors, { y: -70, x: i => [40, -20, -60][i], duration: .8, ease: 'power2.inOut' }, 1);
    tl.to(line, { opacity: 0, duration: .3 }, 1.7);
    tl.from(win, { opacity: 0, scale: .85, duration: .5, ease: 'power3.out' }, 1.8);
    tl.to(cursors, { x: i => [160, 80, -120][i], y: i => [-150, -60, -120][i], duration: 1.2, ease: 'sine.inOut' }, 2.2);
  } },
  { name: 'Secure', build(root, tl) {
    const top = box(root, 'left:70px;top:50px;display:flex;gap:14px;transform:scale(1.5);transform-origin:0 0');
    const tiles = [0, 1].map(() => box(top, `position:relative;width:62px;height:62px;border-radius:14px;background:${PINK}`));
    const pill = box(top, `position:relative;height:62px;padding:0 24px;border-radius:14px;background:#fff;border:2px solid ${GREY};color:${ORANGE};font-size:24px;display:grid;place-items:center`, 'Secure');
    const cta = box(root, `left:70px;top:170px;height:84px;padding:0 36px;border-radius:20px;background:${ORANGE};color:#fff;font-size:36px;display:grid;place-items:center;white-space:nowrap`, 'with enterprise controls');
    tl.from([...tiles, pill], { scale: 0, stagger: .1, duration: .4, ease: 'back.out(1.7)' }, 0);
    tl.from(cta, { opacity: 0, y: 16, duration: .4 }, .45);
    tl.to([top, cta], { opacity: 0, scale: .9, duration: .3 }, 1.5);
    const rows = [0, 1, 2, 3].map(row => {
      const strip = box(root, `left:-40px;top:${40 + row * 78}px;display:flex;gap:14px`);
      for (let i = 0; i < 6; i++) box(strip, `position:relative;width:130px;height:56px;border-radius:10px;background:${(i + row) % 2 ? '#ffffff' : LILAC};border:1.5px solid ${GREY};box-sizing:border-box`);
      return strip;
    });
    const band = box(root, 'left:0;right:0;top:158px;height:44px;background:#ffffff');
    const label = box(root, 'left:0;right:0;top:170px;text-align:center;font-size:26px', 'Trusted by');
    tl.from(rows, { opacity: 0, duration: .3, stagger: .05 }, 1.75);
    tl.to(rows, { x: i => i % 2 ? -110 : 70, duration: 2, ease: 'none' }, 1.75);
    tl.from([band, label], { opacity: 0, duration: .3 }, 2);
  } }
];

export function buildScrap(index, root, duration) {
  paper(root);
  const tl = gsap.timeline({ paused: true });
  scenes[index].build(root, tl);
  if (tl.duration() < duration) tl.to({}, { duration: duration - tl.duration() });
  return tl;
}
export const scrapNames = scenes.map(scene => scene.name);
