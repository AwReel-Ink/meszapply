// Dialogue avec l'API GitHub, directement depuis le navigateur.
import { OWNER, REPO, BRANCH } from './config.js';

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(message, status = 0, kind = 'other') {
    super(message);
    this.status = status;
    this.kind = kind; // 'auth' | 'forbidden' | 'conflict' | 'notfound' | 'ratelimit' | 'network' | 'other'
  }
}

// --- Encodage base64 compatible accents et émojis ---------------------------
export function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function decodeBase64(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// --- Requête générique -------------------------------------------------------
async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch (e) {
    throw new GitHubError('Impossible de joindre GitHub. Vérifie ta connexion internet.', 0, 'network');
  }

  if (res.ok) return res.status === 204 ? null : res.json();

  let detail = '';
  try { detail = (await res.json()).message || ''; } catch { /* corps vide */ }

  const remaining = res.headers.get('x-ratelimit-remaining');
  if ((res.status === 403 || res.status === 429) && remaining === '0') {
    const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
    const minutes = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 60000)) : 60;
    throw new GitHubError(
      `GitHub limite le nombre de demandes. Réessaie dans ${minutes} min, ou enregistre ton jeton dans les Paramètres pour lever cette limite.`,
      res.status, 'ratelimit');
  }
  switch (res.status) {
    case 401:
      throw new GitHubError('GitHub refuse ce jeton : il est invalide ou a expiré. Crée-en un nouveau et colle-le dans les Paramètres.', 401, 'auth');
    case 403:
      throw new GitHubError(`Ce jeton n'a pas le droit de modifier le dépôt ${REPO}. Sur GitHub, vérifie qu'il donne accès à ${REPO} avec la permission « Contents : Read and write ».`, 403, 'forbidden');
    case 404:
      throw new GitHubError('Élément introuvable sur GitHub.', 404, 'notfound');
    case 409:
    case 422:
      if (/sha|match|conflict/i.test(detail) || res.status === 409) {
        throw new GitHubError('La galerie a été modifiée depuis un autre appareil.', res.status, 'conflict');
      }
      throw new GitHubError(`GitHub a refusé la demande : ${detail}`, res.status, 'other');
    default:
      throw new GitHubError(`Erreur GitHub (${res.status}) ${detail}`.trim(), res.status, 'other');
  }
}

// --- Fonctions utilisées par l'appli -----------------------------------------

/** Vérifie le jeton et renvoie le nom du compte. */
export async function getUser(token) {
  const user = await request('/user', { token });
  return user.login;
}

/** Lit un fichier JSON du dépôt. Renvoie { data, sha }. */
export async function getJsonFile(path, token) {
  const file = await request(
    `/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}?ref=${BRANCH}&t=${Date.now()}`,
    { token });
  return { data: JSON.parse(decodeBase64(file.content)), sha: file.sha };
}

/** Écrit un fichier JSON dans le dépôt (un commit). Renvoie le nouveau sha. */
export async function putJsonFile(path, data, sha, message, token) {
  const content = encodeBase64(JSON.stringify(data, null, 2) + '\n');
  const res = await request(`/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}`, {
    method: 'PUT',
    token,
    body: { message, content, sha, branch: BRANCH },
  });
  return res.content.sha;
}

/** Liste les dépôts publics du compte. */
export async function listRepos(token) {
  const all = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await request(
      `/users/${OWNER}/repos?per_page=100&type=owner&sort=updated&page=${page}`,
      { token });
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}
