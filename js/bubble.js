// La bulle flottante.
//
//  ☰  Les 3 traits : la poignée. Glisser = déplacer. Appui = déployer / replier.
//     Si la bulle est transparente, le premier appui la réveille seulement.
//  ✕  Fermer l'appli à l'écran et revenir à l'accueil
//  ⌂  Revenir à l'accueil de MesZapply (les applis restent ouvertes)
//  >  Passer à l'appli ouverte suivante, en boucle
//
// Repliée automatiquement après quelques secondes, puis semi-transparente.
import { el, icons } from './ui.js';
import * as db from './db.js';
import * as win from './windows.js';

const COLLAPSE_DELAY = 3500;   // ms sans contact avant de replier
const FADE_DELAY = 3000;       // ms supplémentaires avant la transparence
const DRAG_THRESHOLD = 6;      // px : au-delà, c'est un déplacement
const HANDLE = 56;             // diamètre de la poignée
const SAT = 50;                // diamètre des autres ronds
const SPREAD = 50 * Math.PI / 180;

let root, handle, badge, sats, nextCount;
let pos = { xr: 0.9, yr: 0.72 };   // position en proportion de l'écran
let isOpen = false;
let faded = false;
let collapseTimer = null;
let fadeTimer = null;
let count = 0;
let onHome = true;

export async function initBubble() {
  const saved = await db.get('bubblePos');
  if (saved && typeof saved.xr === 'number') pos = saved;

  handle = el('button.b-btn.b-handle', { type: 'button', 'aria-label': 'Menu des applis ouvertes (glisser pour déplacer)', html: icons.move });
  badge = el('span.b-badge', { 'aria-hidden': 'true' }, '0');
  handle.append(badge);

  nextCount = el('span.b-count', { 'aria-hidden': 'true' }, '0');
  sats = {
    next: el('button.b-btn.b-sat.b-next', { type: 'button', 'aria-label': 'Appli suivante', html: icons.next }),
    home: el('button.b-btn.b-sat.b-home', { type: 'button', 'aria-label': 'Accueil de MesZapply', html: icons.home }),
    close: el('button.b-btn.b-sat.b-close', { type: 'button', 'aria-label': 'Fermer cette appli', html: icons.close }),
  };
  sats.next.append(nextCount);

  root = el('div.bubble', { hidden: true }, [sats.next, sats.home, sats.close, handle]);
  root.id = 'bubble';
  document.body.append(root);

  sats.next.addEventListener('click', () => { touch(); win.next(); });
  sats.home.addEventListener('click', () => { touch(); win.showHome(); });
  sats.close.addEventListener('click', () => { touch(); win.close(); });

  bindHandle();
  document.addEventListener('mz:windows', e => update(e.detail));
  window.addEventListener('resize', () => place());
  window.addEventListener('orientationchange', () => setTimeout(place, 200));
  place();
}

function update({ count: c, activeId }) {
  count = c;
  const wasHome = onHome;
  onHome = !activeId;
  // Changement d'écran (accueil ↔ appli) : la bulle se replie.
  // En passant d'une appli à l'autre avec la flèche, elle reste ouverte.
  if (wasHome !== onHome && isOpen) { collapse(); schedule(); }
  badge.textContent = String(c);
  nextCount.textContent = String(c);
  if (root.hidden && c > 0) { setFaded(false); schedule(); }
  root.hidden = c === 0;
  root.classList.toggle('on-home', onHome);
  if (c === 0) { collapse(); return; }
  layout();
}

// --- Poignée : appui ou glisser ------------------------------------------------
function bindHandle() {
  let start = null;
  let dragging = false;
  let wasFaded = false;

  handle.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button > 0) return;
    start = { x: e.clientX, y: e.clientY };
    dragging = false;
    wasFaded = faded;
    clearTimers();
    setFaded(false);
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', e => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragging = true;
      document.body.classList.add('mz-dragging');
      root.classList.add('dragging');
    }
    if (dragging) {
      pos = { xr: e.clientX / window.innerWidth, yr: e.clientY / window.innerHeight };
      place();
    }
  });

  const end = e => {
    if (!start) return;
    try { handle.releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
    start = null;
    if (dragging) {
      dragging = false;
      document.body.classList.remove('mz-dragging');
      root.classList.remove('dragging');
      db.set('bubblePos', pos);
    } else if (e.type === 'pointerup' && !wasFaded) {
      isOpen ? collapse() : expand();
    }
    schedule();
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);

  // Clavier (PC) : Entrée ou Espace déploie / replie
  handle.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setFaded(false);
      isOpen ? collapse() : expand();
      schedule();
    }
  });
  handle.addEventListener('click', e => e.preventDefault());
}

// --- États -------------------------------------------------------------------
function expand() { isOpen = true; root.classList.add('open'); layout(); }
function collapse() { isOpen = false; root?.classList.remove('open'); }
function setFaded(v) { faded = v; root?.classList.toggle('faded', v); }

function touch() { clearTimers(); setFaded(false); schedule(); }

function clearTimers() { clearTimeout(collapseTimer); clearTimeout(fadeTimer); }

function schedule() {
  clearTimers();
  if (isOpen) {
    collapseTimer = setTimeout(() => { collapse(); fadeTimer = setTimeout(() => setFaded(true), FADE_DELAY); }, COLLAPSE_DELAY);
  } else {
    fadeTimer = setTimeout(() => setFaded(true), FADE_DELAY);
  }
}

// --- Placement ----------------------------------------------------------------
let probe = null;
function insets() {
  if (!probe) {
    probe = el('div', { 'aria-hidden': 'true', style: {
      position: 'fixed', visibility: 'hidden', pointerEvents: 'none', inset: '0',
      paddingTop: 'env(safe-area-inset-top)', paddingRight: 'env(safe-area-inset-right)',
      paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)',
    } });
    document.body.append(probe);
  }
  const cs = getComputedStyle(probe);
  return {
    t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0,
    b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0,
  };
}

function place() {
  if (!root) return;
  const W = window.innerWidth, H = window.innerHeight, ins = insets();
  const m = HANDLE / 2 + 6;
  const x = Math.min(W - m - ins.r, Math.max(m + ins.l, pos.xr * W));
  const y = Math.min(H - m - ins.b, Math.max(m + ins.t, pos.yr * H));
  root.style.left = `${x}px`;
  root.style.top = `${y}px`;
  layout();
}

/** Déploie les ronds en éventail vers le centre de l'écran : jamais hors écran. */
function layout() {
  if (!root) return;
  const W = window.innerWidth, H = window.innerHeight;
  const cx = parseFloat(root.style.left) || W / 2;
  const cy = parseFloat(root.style.top) || H / 2;
  const list = onHome ? [sats.next] : [sats.next, sats.home, sats.close];
  [sats.home, sats.close].forEach(s => s.classList.toggle('gone', onHome));

  let theta = Math.atan2(H / 2 - cy, W / 2 - cx);
  if (Math.hypot(W / 2 - cx, H / 2 - cy) < 40) theta = Math.PI;
  const R = Math.min(90, Math.max(80, Math.min(W, H) * 0.22));
  const m = SAT / 2 + 6;
  const inside = (x, y) => x >= m && x <= W - m && y >= m && y <= H - m;
  const positions = base => list.map((_, i) => {
    const a = base + (i - (list.length - 1) / 2) * SPREAD;
    return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
  });

  // On cherche l'orientation la plus proche du centre où tous les ronds tiennent à l'écran
  let best = null;
  for (let step = 0; step <= 18 && !best; step++) {
    for (const sign of step ? [1, -1] : [1]) {
      const pts = positions(theta + sign * step * Math.PI / 18);
      if (pts.every(([x, y]) => inside(x, y))) { best = pts; break; }
    }
  }
  best = best || positions(theta).map(([x, y]) => [Math.min(W - m, Math.max(m, x)), Math.min(H - m, Math.max(m, y))]);

  list.forEach((s, i) => {
    s.style.setProperty('--dx', `${best[i][0] - cx}px`);
    s.style.setProperty('--dy', `${best[i][1] - cy}px`);
  });
}
