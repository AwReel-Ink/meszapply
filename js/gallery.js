// L'accueil : favoris en haut, puis les applis rangées par catégorie.
import { el, iconEl, toast, letterAvatar } from './ui.js';
import { getPrefs, isFavorite, toggleFavorite } from './prefs.js';
import { resolveIcon, displayIcon, displayColor } from './meta.js';
import * as win from './windows.js';

const LONG_PRESS = 550;
let root;
let lastState = null;

export function initGallery() {
  root = document.getElementById('view-gallery');
  document.addEventListener('mz:windows', e => markOpen(e.detail.open));
}

export function renderGallery(state) {
  lastState = state;
  const { categories, apps } = state.data;
  const visible = apps.filter(a => !a.hidden);
  root.replaceChildren();

  if (!visible.length) {
    root.append(el('div.empty', {}, [
      el('p.empty-title', {}, 'La galerie est vide'),
      el('p.muted', {}, getPrefs().token
        ? 'Ajoute ta première appli depuis l\'onglet « Gérer ».'
        : 'Les applis apparaîtront ici dès qu\'elles seront ajoutées.'),
    ]));
    return;
  }

  // Favoris (propres à cet appareil)
  const favs = getPrefs().favorites.map(id => visible.find(a => a.id === id)).filter(Boolean);
  if (favs.length) root.append(section('⭐', 'Favoris', favs, 'favorites'));

  // Catégories dans l'ordre choisi ; les catégories vides ne s'affichent pas
  for (const cat of categories) {
    const list = visible.filter(a => a.category === cat.id);
    if (list.length) root.append(section(cat.emoji, cat.name, list, cat.id));
  }
  const known = new Set(categories.map(c => c.id));
  const orphans = visible.filter(a => !known.has(a.category));
  if (orphans.length) root.append(section('📁', 'Sans catégorie', orphans, '_none'));

  if (!favs.length) {
    root.append(el('p.hint', {}, 'Astuce : appui long sur une appli pour l\'ajouter aux favoris.'));
  }
  markOpen(null);
}

function section(emoji, name, list, key) {
  const grid = el('div.app-grid');
  list.forEach(app => grid.append(card(app)));
  return el('section.cat', { dataset: { cat: key } }, [
    el('h2.cat-title', {}, [el('span.cat-emoji', { 'aria-hidden': 'true' }, emoji), el('span', {}, name)]),
    grid,
  ]);
}

function appIcon(app) {
  const box = el('span.app-icon');
  const fallback = () => box.replaceChildren(letterAvatar(app.name, app.color));
  const known = displayIcon(app);
  if (known) box.append(el('img', { src: known, alt: '', loading: 'lazy', onerror: fallback }));
  else fallback();

  if (!app.icon) {
    // Icône pas enregistrée : on la cherche (ou on la rafraîchit) dans le manifest de l'appli
    resolveIcon(app.url).then(found => {
      if (found?.icon && found.icon !== known) {
        const img = el('img', { src: found.icon, alt: '' });
        img.addEventListener('load', () => box.replaceChildren(img), { once: true });
      }
      if (found?.color && !app.color) box.closest('.app-card')?.style.setProperty('--app-color', found.color);
    }).catch(() => {});
  }
  return box;
}

function card(app) {
  const fav = isFavorite(app.id);
  const node = el('button.app-card', {
    type: 'button',
    dataset: { id: app.id },
    title: app.openMode === 'outside' ? `${app.name} (s'ouvre à part)` : app.name,
  }, [
    appIcon(app),
    el('span.app-text', {}, [
      el('span.app-name', {}, app.name),
      app.description ? el('span.app-desc', {}, app.description) : null,
    ]),
    fav ? iconEl('star', 'app-star') : null,
    app.openMode === 'outside' ? iconEl('external', 'app-ext') : null,
    el('span.app-open-dot', { 'aria-hidden': 'true' }),
  ]);
  const color = displayColor(app);
  if (color) node.style.setProperty('--app-color', color);
  bindPress(node, app);
  return node;
}

// --- Appui court = lancer ; appui long (ou clic droit) = favori ---------------
function bindPress(node, app) {
  let timer = null, start = null, longDone = false, lastType = 'mouse';

  node.addEventListener('pointerdown', e => {
    lastType = e.pointerType || 'mouse';
    if (e.button === 2) return;
    longDone = false;
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(async () => {
      longDone = true;
      node.classList.add('pressed');
      if (navigator.vibrate) navigator.vibrate(25);
      await flipFavorite(app);
    }, LONG_PRESS);
  });
  node.addEventListener('pointermove', e => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) clearTimeout(timer);
  });
  const cancel = () => { clearTimeout(timer); start = null; node.classList.remove('pressed'); };
  node.addEventListener('pointerup', cancel);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('pointerleave', cancel);

  node.addEventListener('contextmenu', e => {
    e.preventDefault();
    // Clic droit à la souris (PC) : bascule favori directement
    if (lastType === 'mouse' && !longDone) flipFavorite(app);
  });
  node.addEventListener('click', e => {
    if (longDone) { e.preventDefault(); longDone = false; return; }
    win.launch(app);
  });
}

async function flipFavorite(app) {
  const now = await toggleFavorite(app.id);
  toast(now ? `${app.name} ajoutée aux favoris` : `${app.name} retirée des favoris`, { duration: 1800 });
  if (lastState) renderGallery(lastState);
}

function markOpen(openIds) {
  const ids = new Set(openIds || []);
  if (!openIds) {
    root.querySelectorAll('.app-card').forEach(c => c.classList.toggle('is-open', win.isOpen(c.dataset.id)));
  } else {
    root.querySelectorAll('.app-card').forEach(c => c.classList.toggle('is-open', ids.has(c.dataset.id)));
  }
}
