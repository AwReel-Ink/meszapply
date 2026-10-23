// La galerie partagée : catégories + applis, stockées dans data/apps.json sur GitHub.
// GitHub est la seule source de vérité : on relit toujours la dernière version.
import { DATA_PATH } from './config.js';
import * as gh from './github.js';
import * as db from './db.js';

const state = {
  data: { categories: [], apps: [] },
  sha: null,          // empreinte du fichier sur GitHub (nécessaire pour écrire)
  source: 'none',     // 'github' | 'pages' | 'cache'
  token: null,
};

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }

export function getState() { return state; }
export function setToken(token) { state.token = token || null; }

// --- Normalisation : garantit une structure propre quoi qu'il arrive --------
function normalize(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const apps = Array.isArray(data.apps) ? data.apps : [];
  return {
    schema: 1,
    updatedAt: data.updatedAt || null,
    categories: categories
      .filter(c => c && c.id)
      .map(c => ({ id: String(c.id), name: String(c.name || c.id), emoji: c.emoji || '📁' })),
    apps: apps
      .filter(a => a && a.id && a.url)
      .map(a => ({
        id: String(a.id),
        name: String(a.name || a.id),
        description: String(a.description || ''),
        url: String(a.url),
        repo: a.repo ? String(a.repo) : '',
        icon: a.icon ? String(a.icon) : '',
        color: a.color ? String(a.color) : '',
        category: a.category ? String(a.category) : '',
        hidden: !!a.hidden,
        openMode: a.openMode === 'outside' ? 'outside' : 'inside',
      })),
  };
}

function apply(data, sha, source) {
  state.data = normalize(data);
  state.sha = sha;
  state.source = source;
  db.set('gallery', { data: state.data, sha, savedAt: Date.now() });
  emit();
}

// --- Lecture -----------------------------------------------------------------
export async function loadCached() {
  const cached = await db.get('gallery');
  if (cached && cached.data) {
    state.data = normalize(cached.data);
    state.sha = cached.sha || null;
    state.source = 'cache';
    emit();
    return true;
  }
  return false;
}

/** Recharge la galerie depuis GitHub (ou à défaut depuis la page publiée). */
export async function refresh() {
  try {
    const { data, sha } = await gh.getJsonFile(DATA_PATH, state.token);
    apply(data, sha, 'github');
    return 'github';
  } catch (err) {
    // Jeton refusé : on lit quand même la galerie sans jeton, puis on signale le problème.
    if (err.kind === 'auth' && state.token) {
      let publicOk = false;
      try {
        const { data, sha } = await gh.getJsonFile(DATA_PATH, null);
        apply(data, sha, 'github');
        publicOk = true;
      } catch { /* on passe à la page publiée */ }
      if (!publicOk) await refreshFromPages();
      throw err;
    }
    console.warn('[store] lecture GitHub impossible, essai de la page publiée', err);
    return refreshFromPages();
  }
}

async function refreshFromPages() {
  try {
    const res = await fetch(`./${DATA_PATH}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    apply(await res.json(), null, 'pages');
    return 'pages';
  } catch (e) {
    console.warn('[store] page publiée injoignable, on garde la version locale', e);
    if (state.source === 'none') await loadCached();
    return 'cache';
  }
}

// --- Écriture ----------------------------------------------------------------
let queue = Promise.resolve();

/**
 * Applique une modification à la galerie et l'enregistre sur GitHub (un commit).
 * `change(data)` modifie l'objet reçu. En cas de modification simultanée depuis
 * un autre appareil, on relit la dernière version et on ré-applique la
 * modification dessus : rien n'est perdu.
 * Renvoie { merged } : true si une modification d'un autre appareil a été intégrée.
 */
export function mutate(change, message) {
  const run = async () => {
    if (!state.token) throw new gh.GitHubError('Enregistre ton jeton GitHub dans les Paramètres pour modifier la galerie.', 0, 'auth');

    let merged = false;
    if (!state.sha || state.source !== 'github') {
      const latest = await gh.getJsonFile(DATA_PATH, state.token);
      apply(latest.data, latest.sha, 'github');
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const draft = structuredClone(state.data);
      change(draft);                         // peut lever une erreur de validation
      draft.updatedAt = new Date().toISOString();
      const clean = normalize(draft);
      try {
        const sha = await gh.putJsonFile(DATA_PATH, clean, state.sha, message, state.token);
        apply(clean, sha, 'github');
        return { merged };
      } catch (err) {
        if (err.kind !== 'conflict') throw err;
        merged = true;
        const latest = await gh.getJsonFile(DATA_PATH, state.token);
        apply(latest.data, latest.sha, 'github');
      }
    }
    throw new gh.GitHubError('La galerie change trop souvent depuis un autre appareil. Réessaie dans un instant.', 409, 'conflict');
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

// --- Petits outils ------------------------------------------------------------
export function slugify(text) {
  return String(text)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'element';
}

export function uniqueId(base, existing) {
  const ids = new Set(existing);
  let id = slugify(base), n = 2;
  while (ids.has(id)) id = `${slugify(base)}-${n++}`;
  return id;
}

export function categoryOf(id) {
  return state.data.categories.find(c => c.id === id) || null;
}
