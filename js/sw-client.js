// Enregistrement du service worker et mises à jour de MesZapply.
import { toast } from './ui.js';
import { getOpenCount } from './windows.js';

let registration = null;
let refreshing = false;

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
  } catch (e) {
    console.warn('[sw] enregistrement impossible', e);
    return;
  }

  if (registration.waiting && navigator.serviceWorker.controller) offerUpdate(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });

  // Vérifie les mises à jour à chaque retour sur l'appli (au plus une fois par heure)
  let lastCheck = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastCheck > 3600e3) {
      lastCheck = Date.now();
      registration.update().catch(() => {});
    }
  });
}

function offerUpdate(worker) {
  const apply = () => worker.postMessage({ type: 'SKIP_WAITING' });
  const n = getOpenCount();
  toast(n
    ? `Nouvelle version de MesZapply disponible. La mise à jour fermera tes ${n} appli${n > 1 ? 's' : ''} ouverte${n > 1 ? 's' : ''}.`
    : 'Nouvelle version de MesZapply disponible.', {
    type: 'info', duration: 0, action: apply, actionLabel: 'Mettre à jour',
  });
}

/** Renvoie 'found' | 'none' | 'unsupported'. */
export async function checkForUpdate() {
  if (!registration) return 'unsupported';
  try {
    await registration.update();
  } catch {
    return 'unsupported';
  }
  const worker = registration.installing || registration.waiting;
  if (!worker) return 'none';
  if (registration.waiting) offerUpdate(registration.waiting);
  return 'found';
}
