// Stockage local de MesZapply (IndexedDB).
// Tout ce qui est propre à CET appareil vit ici :
//   - token        : le jeton GitHub (jamais envoyé ailleurs qu'à api.github.com)
//   - login        : le compte GitHub associé au jeton
//   - maxOpen      : la limite d'applis ouvertes en même temps
//   - favorites    : la liste des favoris (par appareil)
//   - bubblePos    : la position de la bulle
//   - gallery      : la dernière galerie connue (pour l'affichage hors ligne)
//   - iconCache    : les icônes retrouvées automatiquement
//
// Base nommée « meszapply » pour ne jamais croiser les bases des autres applis.

const DB_NAME = 'meszapply';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export async function get(key, fallback = undefined) {
  try {
    const value = await tx('readonly', s => s.get(key));
    return value === undefined ? fallback : value;
  } catch (e) {
    console.warn('[db] lecture impossible', key, e);
    return fallback;
  }
}

export async function set(key, value) {
  try {
    await tx('readwrite', s => s.put(value, key));
  } catch (e) {
    console.warn('[db] écriture impossible', key, e);
  }
}

export async function del(key) {
  try {
    await tx('readwrite', s => s.delete(key));
  } catch (e) {
    console.warn('[db] suppression impossible', key, e);
  }
}
