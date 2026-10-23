// Gestion des applis ouvertes : chacune vit dans un cadre plein écran,
// une seule est visible à la fois, les autres attendent en arrière-plan
// en gardant leur état.
import { el, openSheet, toast, letterAvatar } from './ui.js';
import { getPrefs } from './prefs.js';
import { displayIcon } from './meta.js';

const open = [];       // [{ app, frame, wrap }] dans l'ordre d'ouverture
let activeId = null;   // null = accueil de MesZapply
let lastActiveId = null;
let container;

export function initWindows() {
  container = document.getElementById('windows');

  // Bouton retour du téléphone (ou du navigateur) : retour à l'accueil.
  window.addEventListener('popstate', () => {
    if (activeId) showHome({ fromHistory: true });
  });
}

function emit() {
  document.dispatchEvent(new CustomEvent('mz:windows', {
    detail: { count: open.length, activeId, open: open.map(w => w.app.id) },
  }));
}

export function getOpenCount() { return open.length; }
export function getActiveId() { return activeId; }
export function isOpen(id) { return open.some(w => w.app.id === id); }

/** Lance une appli (ou la remet au premier plan si elle est déjà ouverte). */
export function launch(app) {
  if (app.openMode === 'outside') {
    window.open(app.url, '_blank', 'noopener');
    return;
  }
  if (isOpen(app.id)) { activate(app.id); return; }
  if (open.length >= getPrefs().maxOpen) { askToFreeSlot(app); return; }

  const frame = el('iframe.win-frame', {
    src: app.url,
    title: app.name,
    allow: 'camera; microphone; geolocation; fullscreen; clipboard-read; clipboard-write; web-share; autoplay; screen-wake-lock; display-capture; picture-in-picture',
    referrerpolicy: 'no-referrer-when-downgrade',
  });
  const loader = el('div.win-loader', {}, [
    el('div.win-loader-icon', {}, [displayIcon(app)
      ? el('img', { src: displayIcon(app), alt: '' })
      : letterAvatar(app.name, app.color)]),
    el('p', {}, `Ouverture de ${app.name}…`),
  ]);
  frame.addEventListener('load', () => loader.classList.add('done'), { once: true });
  setTimeout(() => loader.classList.add('done'), 12000);

  const wrap = el('div.win', { dataset: { id: app.id } }, [frame, loader]);
  container.append(wrap);
  open.push({ app, frame, wrap });
  activate(app.id);
}

function activate(id) {
  const target = open.find(w => w.app.id === id);
  if (!target) return;
  open.forEach(w => w.wrap.classList.toggle('active', w === target));
  const wasHome = !activeId;
  activeId = id;
  lastActiveId = id;
  document.body.dataset.view = 'app';
  if (wasHome && history.state?.mz !== 'app') history.pushState({ mz: 'app' }, '');
  emit();
  // Donne le focus à l'appli pour que le clavier fonctionne directement sur PC
  setTimeout(() => { try { target.frame.contentWindow?.focus(); } catch { /* ignoré */ } }, 50);
}

/** Retour à l'accueil de MesZapply (les applis restent ouvertes). */
export function showHome({ fromHistory = false } = {}) {
  if (!activeId) return;
  open.forEach(w => w.wrap.classList.remove('active'));
  activeId = null;
  document.body.dataset.view = 'home';
  if (!fromHistory && history.state?.mz === 'app') history.back();
  emit();
}

/** Passe à l'appli ouverte suivante (en boucle). Depuis l'accueil : la dernière utilisée. */
export function next() {
  if (!open.length) return;
  if (!activeId) {
    const last = open.find(w => w.app.id === lastActiveId) || open[open.length - 1];
    activate(last.app.id);
    return;
  }
  if (open.length === 1) {
    toast('Une seule appli est ouverte.', { duration: 1600 });
    return;
  }
  const i = open.findIndex(w => w.app.id === activeId);
  activate(open[(i + 1) % open.length].app.id);
}

/** Ferme une appli (par défaut celle à l'écran) et revient à l'accueil. */
export function close(id = activeId) {
  const i = open.findIndex(w => w.app.id === id);
  if (i < 0) return;
  const [w] = open.splice(i, 1);
  w.frame.src = 'about:blank';
  w.wrap.remove();
  if (lastActiveId === id) lastActiveId = open.length ? open[open.length - 1].app.id : null;
  if (activeId === id) {
    showHome();
  } else {
    emit();
  }
}

/** Met à jour les infos d'une appli ouverte si elle a été modifiée dans « Gérer ». */
export function syncOpenApps(apps) {
  for (const w of [...open]) {
    const fresh = apps.find(a => a.id === w.app.id);
    if (!fresh) close(w.app.id);
    else w.app = fresh;
  }
}

// --- Limite atteinte : proposer de fermer une appli ----------------------------
function askToFreeSlot(app) {
  const list = el('ul.free-list');
  const content = el('div', {}, [
    el('p.muted', {}, `Tu as déjà ${open.length} appli${open.length > 1 ? 's' : ''} ouverte${open.length > 1 ? 's' : ''} (limite réglable dans les Paramètres). Ferme-en une pour lancer ${app.name}.`),
    list,
  ]);
  open.forEach(w => {
    list.append(el('li.free-item', {}, [
      el('span.free-icon', {}, [displayIcon(w.app) ? el('img', { src: displayIcon(w.app), alt: '' }) : letterAvatar(w.app.name, w.app.color)]),
      el('span.free-name', {}, w.app.name),
      el('button.btn.btn-danger.btn-small', {
        type: 'button',
        onclick: () => { close(w.app.id); sheet.close(); launch(app); },
      }, 'Fermer'),
    ]));
  });
  const sheet = openSheet({ title: 'Limite d\'applis ouvertes', content });
}
