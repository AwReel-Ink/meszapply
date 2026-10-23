// Démarrage de MesZapply.
import * as store from './store.js';
import { loadPrefs, getPrefs, onPrefsChange } from './prefs.js';
import { initWindows, syncOpenApps } from './windows.js';
import { initBubble } from './bubble.js';
import { initGallery, renderGallery } from './gallery.js';
import { initManage, renderManage } from './manage.js';
import { openSettings } from './settings.js';
import { registerSW } from './sw-client.js';
import { toast, icons } from './ui.js';
import { loadIconCache } from './meta.js';

const $ = sel => document.querySelector(sel);
let tab = 'gallery';
let lastRefresh = 0;

async function start() {
  document.body.dataset.view = 'home';
  $('#btn-settings').innerHTML = icons.gear;
  $('#btn-refresh').innerHTML = icons.refresh;

  await loadPrefs();
  await loadIconCache();
  store.setToken(getPrefs().token);

  initWindows();
  initGallery();
  initManage();
  await initBubble();

  store.subscribe(state => {
    renderGallery(state);
    if (tab === 'manage') renderManage(state);
    syncOpenApps(state.data.apps);
    showSource(state.source);
  });

  onPrefsChange(key => {
    if (key === 'token') updateTabs();
    if (key === 'favorites') { /* la galerie se redessine elle-même */ }
  });

  // Onglets
  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-refresh').addEventListener('click', () => refresh(true));
  updateTabs();

  // Affiche tout de suite la dernière version connue, puis va chercher la plus récente
  const hadCache = await store.loadCached();
  if (!hadCache) $('#view-gallery').innerHTML = '<p class="muted loading">Chargement de la galerie…</p>';
  await refresh(false);

  // Resynchronise quand on revient sur l'appli (une autre machine a pu modifier la galerie)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 60e3) refresh(false);
  });
  window.addEventListener('online', () => refresh(false));

  registerSW();
}

async function refresh(manual) {
  lastRefresh = Date.now();
  const btn = $('#btn-refresh');
  btn.classList.add('spinning');
  try {
    const source = await store.refresh();
    if (manual) {
      if (source === 'github') toast('Galerie à jour', { type: 'success', duration: 1800 });
      else if (source === 'pages') toast('GitHub ne répond pas : galerie lue depuis la page publiée.', { duration: 4000 });
      else toast('Hors ligne : affichage de la dernière version connue.', { duration: 4000 });
    }
  } catch (err) {
    toast(err.message, { type: 'error', duration: 8000 });
  } finally {
    btn.classList.remove('spinning');
  }
}

function showSource(source) {
  const line = $('#status-line');
  if (source === 'cache') {
    line.textContent = 'Hors ligne : dernière version connue de la galerie.';
    line.hidden = false;
  } else {
    line.hidden = true;
  }
}

function updateTabs() {
  const hasToken = !!getPrefs().token;
  $('#tabs').hidden = !hasToken;
  if (!hasToken && tab === 'manage') switchTab('gallery');
}

function switchTab(name) {
  tab = name;
  document.querySelectorAll('.tab').forEach(b => {
    const on = b.dataset.tab === name;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  $('#view-gallery').hidden = name !== 'gallery';
  $('#view-manage').hidden = name !== 'manage';
  if (name === 'manage') renderManage(store.getState());
  window.scrollTo({ top: 0 });
}

start().catch(err => {
  console.error(err);
  document.getElementById('view-gallery').innerHTML =
    `<p class="muted">MesZapply n'a pas pu démarrer : ${String(err.message || err)}</p>`;
});
