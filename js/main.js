import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { Showroom } from './scene.js';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Keep in sync with the model preload media queries in index.html.
const mobile = matchMedia('(max-width: 900px), (pointer: coarse)').matches;
const debug = new URLSearchParams(location.search).has('debug');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];


/* ─────────────────────────────────────────────
   Camera script
   Each keyframe sits at a section + local progress (0–1 through that section's scroll).
   theta: orbit angle in degrees (0 = looking at the car's nose), phi: elevation,
   radius: distance, t*: look-at target, shift*: frame offset so text has room,
   light: room lights, bars: overhead light bars, scene: 0–2 single car, 3 line-up.
   ───────────────────────────────────────────── */
const K = (section, at, v) => ({ section, at, ...v });
const BASE = { theta: 0, phi: 6, radius: 9, tx: 0, ty: 0.65, tz: 0, shiftX: 0.14, shiftY: 0, light: 1, bars: 1, scene: 0 };

const SCRIPT = [
  K('hero', 0,     { scene: 0, theta: 38, phi: 3, radius: 8.6, ty: 0.55, shiftX: 0, shiftY: -0.1, light: 0.1, bars: 0 }),
  K('hero', 1,     { scene: 0, theta: 26, phi: 5, radius: 8.2, ty: 0.6, shiftX: 0, shiftY: -0.04, light: 0.22, bars: 0.12 }),
  K('intro', 0.35, { scene: 0, theta: 0, phi: 7, radius: 9.6, shiftX: 0.24, light: 0.75, bars: 1 }),
  K('intro', 1,    { scene: 0, theta: -30, phi: 8, radius: 9.6, shiftX: 0.22, light: 1, bars: 1 }),

  // I — Mustang
  K('mustang', 0,    { scene: 0, theta: -40, phi: 7, radius: 8.6, shiftX: 0.16 }),
  K('mustang', 0.22, { scene: 0, theta: -8, phi: 9, radius: 7.2, ty: 0.7, tz: 0.4, shiftX: 0.16 }),
  K('mustang', 0.3,  { scene: 0, theta: 24, phi: 13, radius: 5.6, ty: 0.75, tz: 1.1, shiftX: 0.16 }),
  K('mustang', 0.48, { scene: 0, theta: 28, phi: 11, radius: 6.0, ty: 0.75, tz: 1.0, shiftX: 0.16 }),
  K('mustang', 0.56, { scene: 0, theta: 90, phi: 2.5, radius: 9.4, ty: 0.62, shiftX: 0.12 }),
  K('mustang', 0.72, { scene: 0, theta: 96, phi: 3, radius: 9.2, ty: 0.62, shiftX: 0.12 }),
  K('mustang', 0.82, { scene: 0, theta: 148, phi: 10, radius: 8.4, shiftX: 0.14 }),
  K('mustang', 0.94, { scene: 0, theta: 196, phi: 12, radius: 8.8, shiftX: 0.14, light: 1 }),
  K('mustang', 1,    { scene: 0, theta: 214, phi: 13, radius: 9.2, shiftX: 0.14, light: 0, bars: 0.15 }),

  // II — NSX
  K('nsx', 0,    { scene: 1, theta: 280, phi: 4, radius: 9.8, shiftX: 0.16, light: 0, bars: 0.15 }),
  K('nsx', 0.08, { scene: 1, theta: 302, phi: 5, radius: 8.8, shiftX: 0.16, light: 1, bars: 1 }),
  K('nsx', 0.22, { scene: 1, theta: 322, phi: 6, radius: 8.2, shiftX: 0.16 }),
  K('nsx', 0.3,  { scene: 1, theta: 210, phi: 12, radius: 6.8, ty: 0.7, tz: -0.4, shiftX: 0.16 }),
  K('nsx', 0.48, { scene: 1, theta: 200, phi: 14, radius: 6.8, ty: 0.7, tz: -0.4, shiftX: 0.16 }),
  K('nsx', 0.56, { scene: 1, theta: 382, phi: 1.2, radius: 6.8, ty: 0.42, shiftX: 0.14 }),
  K('nsx', 0.72, { scene: 1, theta: 394, phi: 1.6, radius: 6.6, ty: 0.42, shiftX: 0.14 }),
  K('nsx', 0.82, { scene: 1, theta: 450, phi: 62, radius: 10.5, ty: 0.2, shiftX: 0.14 }),
  K('nsx', 0.94, { scene: 1, theta: 488, phi: 40, radius: 10, shiftX: 0.14, light: 1 }),
  K('nsx', 1,    { scene: 1, theta: 500, phi: 34, radius: 10, shiftX: 0.14, light: 0, bars: 0.15 }),

  // III — Roma
  K('roma', 0,    { scene: 2, theta: 490, phi: 5, radius: 10, shiftX: 0.16, light: 0, bars: 0.15 }),
  K('roma', 0.08, { scene: 2, theta: 474, phi: 5, radius: 9, shiftX: 0.16, light: 1, bars: 1 }),
  K('roma', 0.22, { scene: 2, theta: 420, phi: 6, radius: 8.8, shiftX: 0.16 }),
  K('roma', 0.3,  { scene: 2, theta: 378, phi: 16, radius: 6.2, ty: 0.6, tz: 1.1, shiftX: 0.16 }),
  K('roma', 0.48, { scene: 2, theta: 366, phi: 14, radius: 6.4, ty: 0.6, tz: 1.1, shiftX: 0.16 }),
  K('roma', 0.56, { scene: 2, theta: 270, phi: 1.5, radius: 9.2, ty: 0.5, shiftX: 0.1 }),
  K('roma', 0.72, { scene: 2, theta: 276, phi: 2, radius: 8.6, ty: 0.5, shiftX: 0.1 }),
  K('roma', 0.82, { scene: 2, theta: 214, phi: 9, radius: 8.6, shiftX: 0.14 }),
  K('roma', 0.94, { scene: 2, theta: 160, phi: 11, radius: 9, shiftX: 0.14, light: 1 }),
  K('roma', 1,    { scene: 2, theta: 146, phi: 12, radius: 9.4, shiftX: 0.14, light: 0, bars: 0.15 }),

  // Line-up
  K('lineup', 0,    { scene: 3, theta: 24, phi: 4, radius: 17, ty: 0.9, shiftX: 0, shiftY: -0.16, light: 0, bars: 0.15 }),
  K('lineup', 0.12, { scene: 3, theta: 6, phi: 6, radius: 15.5, ty: 0.9, shiftX: 0, shiftY: -0.16, light: 1, bars: 1 }),
  K('lineup', 0.7,  { scene: 3, theta: -6, phi: 9, radius: 14.5, ty: 0.9, shiftX: 0, shiftY: -0.16 }),
  K('lineup', 1,    { scene: 3, theta: -12, phi: 14, radius: 15, ty: 0.9, shiftX: 0, shiftY: -0.16 }),

  // Visit
  K('visit', 0,    { scene: 3, theta: -16, phi: 22, radius: 16, ty: 0.9, shiftX: 0.18, shiftY: -0.1, light: 0.9 }),
  K('visit', 0.5,  { scene: 3, theta: -24, phi: 58, radius: 18, ty: 0.3, shiftX: 0.2, shiftY: 0, light: 0.45, bars: 0.6 }),
  K('visit', 1,    { scene: 3, theta: -30, phi: 70, radius: 20, ty: 0.3, shiftX: 0.2, shiftY: 0, light: 0.3, bars: 0.4 }),
].map((k) => ({ ...BASE, ...k }));

const NUMERIC = ['theta', 'phi', 'radius', 'tx', 'ty', 'tz', 'shiftX', 'shiftY', 'light', 'bars'];

// Hotspots, in car-relative box fractions: x (-1 left … 1 right), y (0 floor … 1 roof), z (-1 tail … 1 nose)
const HOTSPOTS = [
  { section: 'mustang', car: 0, step: 1, at: [0, 0.72, 0.62], kicker: 'Under the hood', label: '289 V8 · 271 hp' },
  { section: 'mustang', car: 0, step: 2, at: [0.98, 0.34, 0.88], kicker: 'Proportion', label: 'Long hood' },
  { section: 'nsx', car: 1, step: 1, at: [0, 0.68, -0.4], kicker: 'Amidships', label: '3.5 L twin-turbo V6' },
  { section: 'nsx', car: 1, step: 2, at: [0.58, 0.28, 0.66], kicker: 'Front axle', label: 'Twin Motor Unit' },
  { section: 'roma', car: 2, step: 1, at: [0, 0.66, 0.48], kicker: 'Front-mid', label: '3.9 L V8 · 620 cv' },
  { section: 'roma', car: 2, step: 2, at: [-0.98, 0.26, 0.64], kicker: 'Top speed', label: '> 320 km/h' },
];

/* ───────── Sections → scroll positions ───────── */
const sections = $$('main > section');
const layout = {};
let docSpan = 0;
function measure() {
  const vh = window.innerHeight;
  docSpan = document.documentElement.scrollHeight - vh;
  for (const el of sections) {
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.hasAttribute('data-sticky') ? el.offsetHeight - vh : Math.max(el.offsetHeight - vh, vh * 0.5);
    layout[el.id] = { el, top, span: Math.max(span, 1) };
  }
  for (const k of SCRIPT) k.y = layout[k.section].top + k.at * layout[k.section].span;
}
const localProgress = (id, y) => {
  const s = layout[id];
  return s ? (y - s.top) / s.span : 0;
};

const smooth = (t) => t * t * (3 - 2 * t);
function sample(y) {
  if (y <= SCRIPT[0].y) return { ...SCRIPT[0] };
  const last = SCRIPT[SCRIPT.length - 1];
  if (y >= last.y) return { ...last };
  let i = 0;
  while (i < SCRIPT.length - 2 && SCRIPT[i + 1].y < y) i++;
  const a = SCRIPT[i], b = SCRIPT[i + 1];
  const raw = b.y === a.y ? 1 : (y - a.y) / (b.y - a.y);
  const t = smooth(Math.min(1, Math.max(0, raw)));
  const out = {};
  for (const key of NUMERIC) out[key] = a[key] + (b[key] - a[key]) * t;
  // Cars swap at the darkest point between two keyframes, never in full light.
  out.scene = a.scene === b.scene ? a.scene : raw < 0.5 ? a.scene : b.scene;
  return out;
}

/* ───────── Boot ───────── */
const canvas = $('#stage');
const params = new URLSearchParams(location.search);
const showroom = new Showroom(canvas, { mobile, reducedMotion, debug, msaa: debug && params.has('msaa') ? +params.get('msaa') : undefined });
const cam = { ...SCRIPT[0] };
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

// Smooth wheel scrolling is a desktop nicety. On touch devices Lenis would attach non-passive touch
// listeners, which make every swipe wait for the main thread — the surest way to make text stutter.
let lenis = null;
if (!reducedMotion && !mobile) {
  lenis = new Lenis({ duration: 1.25, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  lenis.stop(); // the preloader is up; nothing scrolls yet
}
gsap.ticker.lagSmoothing(0);
const scrollTo = (id) => {
  const s = layout[id];
  if (!s) return;
  const y = id === 'hero' ? 0 : s.top + (s.el.hasAttribute('data-sticky') ? s.span * 0.1 : 0);
  lenis ? lenis.scrollTo(y, { duration: 2.2 }) : window.scrollTo({ top: y, behavior: reducedMotion ? 'auto' : 'smooth' });
};
$$('[data-goto]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); scrollTo(el.dataset.goto); }));

let interactionUntil = 0;
const markInteraction = () => { interactionUntil = performance.now() + 250; showroom.interacting = true; };
for (const type of ['touchstart', 'touchmove', 'wheel', 'scroll']) {
  window.addEventListener(type, markInteraction, { passive: true });
}
window.addEventListener('touchend', () => { interactionUntil = performance.now() + 400; }, { passive: true });

window.addEventListener('pointermove', (e) => {
  pointer.x = e.clientX / window.innerWidth - 0.5;
  pointer.y = e.clientY / window.innerHeight - 0.5;
}, { passive: true });

let startedAt = 0;

/* ───────── Loading ───────── */
// Nothing blocks the page: the headline is already on screen (CSS), the first car fades up when it's ready,
// and anyone who scrolls ahead of a download sees that chapter wait in the dark.
const pctEl = $('#loaderPct'), barEl = $('#loaderBar');
const shown = { v: 0 };
const reveal = { v: reducedMotion ? 1 : 0 };
let started = false;
showroom.load((p) => {
  gsap.to(shown, { v: p * 100, duration: 0.35, overwrite: true, onUpdate: () => {
    pctEl.textContent = Math.round(shown.v);
    barEl.style.transform = `scaleX(${shown.v / 100})`;
  } });
}).then(() => {
  measure();
  ScrollTrigger.refresh();
  started = true;
  startedAt = performance.now();
  document.documentElement.classList.add('is-ready');
  lenis?.start();
  if (!reducedMotion) {
    gsap.to(reveal, { v: 1, duration: 1.8, ease: 'power2.inOut' });
    showroom.busyUntil = performance.now() + 1900;
  }
}).catch((err) => {
  console.error(err);
  $('#loaderLabel').textContent = 'The room could not load. Please refresh.';
});

// Late font swaps change text metrics; re-measure once the real faces are in.
document.fonts?.ready.then(() => { measure(); ScrollTrigger.refresh(); });

// Repeat visits come straight from the cache.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* ───────── Frame loop ───────── */
const hotspotEls = HOTSPOTS.map((h) => {
  const el = document.createElement('div');
  el.className = 'hotspot';
  el.innerHTML = `<i class="hotspot__dot"></i><i class="hotspot__line"></i><span class="hotspot__label">${h.kicker}<b>${h.label}</b></span>`;
  $('#hotspots').appendChild(el);
  return el;
});

const pendingEl = $('#pending');
let lastTime = performance.now();
let lastDrawn = 0;
let lastActive = 0;
let activeSection = '';
let frozen = false;
let drewLastTick = false;
let restRequested = false;
const stepState = {};
const IDLE_AFTER = 1000; // ms of stillness before the canvas stops redrawing

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  const y = window.scrollY;
  const goal = sample(y);

  // A chapter whose car is still streaming in stays dark until it arrives.
  const ready = showroom.isSceneReady(goal.scene);
  if (!ready) { goal.light = 0; goal.bars = Math.min(goal.bars, 0.15); }
  pendingEl.hidden = ready || !started;

  // Critically damped follow; scroll sets the intent, the camera catches up like a dolly.
  // Phones scroll on the compositor, so the camera chases a little harder to stay with the text.
  const k = reducedMotion ? 1 : 1 - Math.exp(-dt * (mobile ? 9 : 5.5));
  let motion = 0;
  for (const key of NUMERIC) {
    const d = goal[key] - cam[key];
    cam[key] += d * k;
    // Angles are in degrees, so a hundredth of one is already invisible.
    motion = Math.max(motion, Math.abs(d) * (key === 'theta' || key === 'phi' ? 0.2 : 1));
  }
  if (!reducedMotion && !mobile) {
    const kp = 1 - Math.exp(-dt * 3);
    motion = Math.max(motion, Math.abs(pointer.x - pointer.sx) * 10, Math.abs(pointer.y - pointer.sy) * 10);
    pointer.sx += (pointer.x - pointer.sx) * kp;
    pointer.sy += (pointer.y - pointer.sy) * kp;
  }

  updateChapters(y);
  if (started && !restRequested && (y > 40 || now - startedAt > 2500)) {
    // The reader is moving (or has settled in): fetch the cars for the chapters ahead.
    restRequested = true;
    showroom.loadRest();
  }
  drewLastTick = drewLastTick && started;
  if (!started) return;

  const sceneChanged = showroom.scene_ !== (ready ? goal.scene : -1);
  if (motion > 0.002 || sceneChanged || showroom.isBusy(now) || showroom.needsDraw) lastActive = now;
  // Once the visit page's own background is fully opaque, nothing on the canvas can be seen.
  const covered = y > layout.visit.top + window.innerHeight * 0.6;
  const idle = now - lastActive > IDLE_AFTER;
  if (covered || (idle && lastDrawn > lastActive)) { drewLastTick = false; showroom.applyPendingDpr(true); return; } // a resolution change sets needsDraw, so the next tick repaints

  showroom.setScene(ready ? goal.scene : -1);
  showroom.light = cam.light * reveal.v;
  showroom.bars = cam.bars * reveal.v;
  showroom.applyCamera({ ...cam, theta: cam.theta + pointer.sx * 6, phi: cam.phi - pointer.sy * 3 });
  showroom.interacting = now < interactionUntil;
  showroom.applyPendingDpr();
  showroom.render();
  showroom.needsDraw = false;
  // Only back-to-back frames say anything about speed; a gap after idling is not a slow frame.
  if (drewLastTick && now - startedAt > 2500) showroom.adapt((now - lastDrawn) / 1000, now);
  drewLastTick = true;
  lastDrawn = now; // the last frame before going idle is already the settled one
  updateHotspots();
}

// One ticker drives smooth scroll first, then the camera, so both read the same scroll position.
gsap.ticker.add((time) => {
  if (frozen) return;
  lenis?.raf(time * 1000);
  frame(performance.now());
});

window.addEventListener('resize', () => (lastActive = performance.now()));

// Dev hook (?debug): jump to a scroll position, settle the camera, then stop drawing so a still can be captured.
if (debug) {
  window.__halden = {
    showroom, layout, sample,
    still(id, p = 0) {
      frozen = true;
      lenis?.stop();
      const y = id === 'y' ? p : layout[id].top + p * layout[id].span;
      window.scrollTo(0, y);
      lenis?.scrollTo(y, { immediate: true, force: true });
      Object.assign(cam, sample(window.scrollY));
      $$('.step').forEach((el) => (el.style.transition = 'none'));
      $$('[data-count]').forEach((el) => (el.textContent = el.dataset.count));
      for (const k in stepState) delete stepState[k];
      lastTime = performance.now();
      for (let i = 0; i < 3; i++) { lastActive = performance.now(); frame(performance.now()); }
      return { y: window.scrollY, cam: sample(window.scrollY) };
    },
    resume() { frozen = false; lenis?.start(); },
  };
}

/* ───────── Chapter steps + chrome ───────── */
const chapterEls = $$('.chapter');
const railButtons = $$('.rail button');
const navNum = $('#navNum'), navName = $('#navName'), navProgress = $('#navProgress');
let lastProgress = -1;

function updateChapters(y) {
  // Everything here comes from cached layout: no DOM reads inside the frame loop.
  const vh = window.innerHeight;
  const progress = docSpan > 0 ? Math.round((y / docSpan) * 1000) / 1000 : 0;
  if (progress !== lastProgress) {
    lastProgress = progress;
    navProgress.style.transform = `scaleX(${progress})`;
  }

  let current = sections[0];
  for (const s of sections) if (layout[s.id].top - y <= vh * 0.5) current = s;
  if (current.id !== activeSection) {
    activeSection = current.id;
    navNum.textContent = current.dataset.chapter;
    navName.textContent = current.dataset.name;
    const railId = current.id === 'intro' ? 'hero' : current.id;
    railButtons.forEach((b) => b.classList.toggle('is-active', b.dataset.goto === railId));
  }

  for (const ch of chapterEls) {
    const p = localProgress(ch.id, y);
    const step = Math.max(0, Math.min(3, Math.floor(p * 4)));
    if (stepState[ch.id] === step) continue;
    stepState[ch.id] = step;
    lastActive = performance.now();
    $$('.step', ch).forEach((el) => {
      const n = Number(el.dataset.step);
      el.classList.toggle('is-active', n === step);
      el.classList.toggle('is-past', n < step);
      if (n === step) countUp(el);
    });
  }
}

function countUp(scope) {
  $$('[data-count]', scope).forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const dec = Number(el.dataset.decimals || 0);
    if (reducedMotion) { el.textContent = end.toFixed(dec); return; }
    const o = { v: 0 };
    gsap.fromTo(o, { v: end * 0.35 }, { v: end, duration: 1.4, ease: 'expo.out', overwrite: true,
      onUpdate: () => (el.textContent = o.v.toFixed(dec)) });
  });
}

const hotspotOn = HOTSPOTS.map(() => false);
function updateHotspots() {
  HOTSPOTS.forEach((h, i) => {
    const el = hotspotEls[i];
    const on = !mobile && activeSection === h.section && stepState[h.section] === h.step && showroom.light > 0.8;
    if (on !== hotspotOn[i]) { hotspotOn[i] = on; el.classList.toggle('is-on', on); }
    if (!on) return;
    const w = showroom.anchor(h.car, h.at);
    if (!w) return;
    const s = showroom.project(w);
    el.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)`;
  });
}

/* ───────── Paint swatches ───────── */
$$('.swatches').forEach((group) => {
  const car = Number(group.dataset.car);
  const buttons = $$('button', group);
  const choose = (btn) => {
    buttons.forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
    showroom.setPaint(car, { hex: btn.dataset.hex, metal: +btn.dataset.metal, rough: +btn.dataset.rough });
  };
  buttons.forEach((btn, i) => {
    btn.tabIndex = btn.getAttribute('aria-checked') === 'true' ? 0 : -1;
    btn.addEventListener('click', () => choose(btn));
    btn.addEventListener('keydown', (e) => {
      const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      const next = buttons[(i + dir + buttons.length) % buttons.length];
      buttons.forEach((b) => (b.tabIndex = b === next ? 0 : -1));
      next.focus();
      choose(next);
    });
  });
});

/* ───────── GSAP scroll moments ───────── */
// Intro: words light up as you read.
const intro = $('#introText');
intro.innerHTML = intro.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
const mm = gsap.matchMedia();
mm.add({ motion: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
  if (ctx.conditions.reduce) {
    gsap.set('#introText .w', { opacity: 1 });
    gsap.set('.table__row--bars i', { '--bar': 1 });
    return;
  }
  gsap.to('#introText .w', {
    opacity: 1, ease: 'none', stagger: 0.1,
    scrollTrigger: { trigger: '#intro', start: 'top top', end: 'bottom bottom', scrub: 0.6 },
  });

  gsap.from('.intro .eyebrow', { autoAlpha: 0, x: -20, duration: 1, ease: 'power3.out',
    scrollTrigger: { trigger: '#intro', start: 'top 60%' } });

  // Line-up: rows arrive, then the horsepower bars draw.
  const rows = gsap.timeline({ scrollTrigger: { trigger: '#lineup', start: 'top top+=-10%', toggleActions: 'play none none reverse' } });
  rows.from('.lineup__head > *', { autoAlpha: 0, y: 30, stagger: 0.08, duration: 1, ease: 'expo.out' })
    .from('.table__row', { autoAlpha: 0, y: 18, stagger: 0.07, duration: 0.8, ease: 'power3.out' }, '-=0.7')
    .to('.table__row--bars i', { '--bar': 1, stagger: 0.12, duration: 1.4, ease: 'expo.out' }, '-=0.4')
    .add(() => countUp($('.table__row--bars')), '<');

  // Visit: the Perimeter draws itself, the copy follows.
  const ring = $('.perimeter__ring');
  const len = ring.getTotalLength();
  gsap.set(ring, { strokeDasharray: len, strokeDashoffset: len });
  gsap.to(ring, { strokeDashoffset: 0, ease: 'none',
    scrollTrigger: { trigger: '.perimeter', start: 'top 90%', end: 'bottom 55%', scrub: 0.8 } });
  gsap.from('.visit__copy > :not(svg), .book', { autoAlpha: 0, y: 40, stagger: 0.08, duration: 1.2, ease: 'expo.out',
    scrollTrigger: { trigger: '.visit__grid', start: 'top 75%' } });
  gsap.from('.footer__mark', { yPercent: 40, autoAlpha: 0, duration: 1.6, ease: 'expo.out',
    scrollTrigger: { trigger: '.footer', start: 'top 90%' } });
});

/* ───────── Booking form (front-end only; wire to your CRM/endpoint) ───────── */
const form = $('#bookForm');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const note = $('#bookNote');
  let ok = true;
  for (const input of $$('input[required]', form)) {
    const valid = input.value.trim() && (input.type !== 'email' || /.+@.+\..+/.test(input.value));
    input.setAttribute('aria-invalid', String(!valid));
    if (!valid && ok) { input.focus(); ok = false; }
  }
  if (!ok) { note.textContent = 'Please add your name and a valid email.'; return; }
  const cars = $$('input[name="car"]:checked', form).map((c) => c.nextElementSibling.textContent);
  const first = form.elements.name.value.trim().split(' ')[0];
  note.textContent = `Thank you, ${first}. We'll be in touch within a day to confirm your hour${cars.length ? ` with the ${cars.join(', ')}` : ''}.`;
  form.reset();
});

/* ───────── Resize ───────── */
let resizeT;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { measure(); ScrollTrigger.refresh(); }, 150);
});
measure();
