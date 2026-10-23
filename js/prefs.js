// Préférences propres à cet appareil (gardées dans IndexedDB).
import * as db from './db.js';
import { LIMIT_DEFAULT, LIMIT_MIN, LIMIT_MAX } from './config.js';

const prefs = {
  token: '',
  login: '',
  maxOpen: LIMIT_DEFAULT,
  favorites: [],
};

const listeners = new Set();
export function onPrefsChange(fn) { listeners.add(fn); }
function emit(key) { listeners.forEach(fn => fn(key, prefs)); }

export async function loadPrefs() {
  prefs.token = await db.get('token', '');
  prefs.login = await db.get('login', '');
  prefs.maxOpen = clampLimit(await db.get('maxOpen', LIMIT_DEFAULT));
  prefs.favorites = await db.get('favorites', []);
  return prefs;
}

export function getPrefs() { return prefs; }

export function clampLimit(n) {
  n = Math.round(Number(n));
  if (!Number.isFinite(n)) return LIMIT_DEFAULT;
  return Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, n));
}

export async function setMaxOpen(n) {
  prefs.maxOpen = clampLimit(n);
  await db.set('maxOpen', prefs.maxOpen);
  emit('maxOpen');
}

export async function setToken(token, login) {
  prefs.token = token || '';
  prefs.login = login || '';
  if (prefs.token) {
    await db.set('token', prefs.token);
    await db.set('login', prefs.login);
  } else {
    await db.del('token');
    await db.del('login');
  }
  emit('token');
}

export function isFavorite(id) { return prefs.favorites.includes(id); }

export async function toggleFavorite(id) {
  prefs.favorites = isFavorite(id)
    ? prefs.favorites.filter(f => f !== id)
    : [...prefs.favorites, id];
  await db.set('favorites', prefs.favorites);
  emit('favorites');
  return isFavorite(id);
}
