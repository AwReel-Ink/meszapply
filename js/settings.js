// Menu Paramètres : limite d'applis ouvertes, jeton GitHub, applis masquées,
// mise à jour et informations.
import { el, openSheet, toast, letterAvatar, confirmDialog } from './ui.js';
import { getPrefs, setMaxOpen, setToken, clampLimit } from './prefs.js';
import { OWNER, REPO, AUTHOR_LINE, LIMIT_MIN, LIMIT_MAX } from './config.js';
import * as gh from './github.js';
import * as store from './store.js';
import { setHidden } from './manage.js';
import { checkForUpdate } from './sw-client.js';
import { displayIcon } from './meta.js';

let current = null;

export function openSettings() {
  if (current) return;
  const body = el('div.settings');
  current = openSheet({ title: 'Paramètres', content: body, onClose: () => { current = null; unsub(); } });
  const unsub = store.subscribe(() => { if (current) draw(body); });
  draw(body);
}

function draw(body) {
  const prefs = getPrefs();
  body.replaceChildren(
    limitBlock(prefs),
    tokenBlock(prefs, body),
    prefs.token ? hiddenBlock() : null,
    updateBlock(),
    aboutBlock(),
  );
}

// --- Limite d'applis ouvertes ---------------------------------------------------
function limitBlock(prefs) {
  const value = el('output.stepper-value', {}, String(prefs.maxOpen));
  const change = async delta => {
    const n = clampLimit(Number(value.textContent) + delta);
    value.textContent = String(n);
    minus.disabled = n <= LIMIT_MIN;
    plus.disabled = n >= LIMIT_MAX;
    await setMaxOpen(n);
  };
  const minus = el('button.icon-btn.stepper-btn', { type: 'button', 'aria-label': 'Diminuer', onclick: () => change(-1), disabled: prefs.maxOpen <= LIMIT_MIN }, '−');
  const plus = el('button.icon-btn.stepper-btn', { type: 'button', 'aria-label': 'Augmenter', onclick: () => change(1), disabled: prefs.maxOpen >= LIMIT_MAX }, '+');
  return el('section.set-block', {}, [
    el('h3', {}, 'Applis ouvertes en même temps'),
    el('div.stepper', {}, [minus, value, plus]),
    el('p.muted.small', {}, `Entre ${LIMIT_MIN} et ${LIMIT_MAX}, réglé pour cet appareil. Au lancement, MesZapply démarre toujours sans appli ouverte.`),
  ]);
}

// --- Jeton GitHub ----------------------------------------------------------------
function tokenBlock(prefs, body) {
  const block = el('section.set-block', {}, [el('h3', {}, 'Compte GitHub')]);

  if (prefs.token) {
    const status = el('p.token-ok', {}, `Jeton enregistré sur cet appareil · compte ${prefs.login || OWNER}`);
    block.append(
      status,
      el('p.muted.small', {}, 'L\'onglet « Gérer » est disponible sur cet appareil.'),
      el('div.row-actions.left', {}, [
        el('button.btn.btn-ghost', {
          type: 'button',
          onclick: async e => {
            e.target.disabled = true;
            try {
              const login = await gh.getUser(prefs.token);
              toast(`Jeton valide (compte ${login})`, { type: 'success' });
            } catch (err) {
              toast(err.message, { type: 'error', duration: 7000 });
            }
            e.target.disabled = false;
          },
        }, 'Tester le jeton'),
        el('button.btn.btn-danger', {
          type: 'button',
          onclick: async () => {
            const ok = await confirmDialog({
              title: 'Retirer le jeton ?',
              message: 'Le jeton sera effacé de cet appareil et l\'onglet « Gérer » disparaîtra. Tes autres appareils ne sont pas concernés.',
              okLabel: 'Retirer',
              danger: true,
            });
            if (!ok) return;
            await setToken('');
            store.setToken(null);
            toast('Jeton retiré de cet appareil');
            draw(body);
          },
        }, 'Retirer le jeton'),
      ]),
    );
    return block;
  }

  const input = el('input.input', { type: 'password', placeholder: 'github_pat_…', autocomplete: 'off', spellcheck: false, 'aria-label': 'Jeton GitHub' });
  const show = el('button.btn.btn-ghost.btn-small', { type: 'button', onclick: () => {
    input.type = input.type === 'password' ? 'text' : 'password';
    show.textContent = input.type === 'password' ? 'Afficher' : 'Cacher';
  } }, 'Afficher');
  const saveBtn = el('button.btn.btn-primary', { type: 'submit' }, 'Enregistrer');

  const form = el('form.token-form', {
    onsubmit: async e => {
      e.preventDefault();
      const token = input.value.trim();
      if (!token) { input.focus(); return; }
      saveBtn.disabled = true;
      saveBtn.textContent = 'Vérification…';
      try {
        const login = await gh.getUser(token);
        if (login.toLowerCase() !== OWNER.toLowerCase()) {
          throw new Error(`Ce jeton appartient au compte « ${login} », pas à « ${OWNER} ».`);
        }
        await setToken(token, login);
        store.setToken(token);
        toast('Jeton enregistré : l\'onglet « Gérer » est disponible', { type: 'success' });
        store.refresh().catch(() => {});
        draw(body);
      } catch (err) {
        toast(err.message, { type: 'error', duration: 7000 });
        saveBtn.disabled = false;
        saveBtn.textContent = 'Enregistrer';
      }
    },
  }, [
    el('div.input-row', {}, [input, show]),
    saveBtn,
  ]);

  block.append(
    el('p.muted.small', {}, 'Sans jeton, tu peux utiliser la galerie mais pas la modifier. Le jeton reste uniquement sur cet appareil.'),
    form,
    tokenHelp(),
  );
  return block;
}

function tokenHelp() {
  const steps = [
    'Sur github.com, clique sur ta photo de profil en haut à droite, puis Settings.',
    'Tout en bas du menu de gauche : Developer settings, puis Personal access tokens, puis Fine-grained tokens.',
    'Clique sur Generate new token.',
    'Token name : « MesZapply ». Expiration : 1 an par exemple.',
    `Repository access : choisis Only select repositories, puis uniquement ${REPO}.`,
    'Permissions : dans les permissions du dépôt, trouve Contents et choisis Read and write. Ne touche à rien d\'autre.',
    'Clique sur Generate token, puis copie tout de suite le jeton (il commence par github_pat_). GitHub ne l\'affiche qu\'une seule fois.',
    'Colle-le ici et enregistre. Garde-le dans un endroit sûr pour tes autres appareils.',
  ];
  return el('details.help', {}, [
    el('summary', {}, 'Comment créer un jeton GitHub ?'),
    el('ol', {}, steps.map(s => el('li', {}, s))),
  ]);
}

// --- Applis masquées ---------------------------------------------------------------
function hiddenBlock() {
  const hidden = store.getState().data.apps.filter(a => a.hidden);
  const block = el('section.set-block', {}, [el('h3', {}, 'Applis masquées')]);
  if (!hidden.length) {
    block.append(el('p.muted.small', {}, 'Aucune appli masquée. Pour en masquer une, utilise l\'œil dans l\'onglet « Gérer ».'));
    return block;
  }
  const ul = el('ul.hidden-list');
  hidden.forEach(app => ul.append(el('li', {}, [
    el('span.row-icon', {}, [displayIcon(app) ? el('img', { src: displayIcon(app), alt: '' }) : letterAvatar(app.name, app.color)]),
    el('span.hidden-name', {}, app.name),
    el('button.btn.btn-ghost.btn-small', { type: 'button', onclick: e => { e.target.disabled = true; setHidden(app, false); } }, 'Afficher'),
  ])));
  block.append(ul);
  return block;
}

// --- Mise à jour ---------------------------------------------------------------------
function updateBlock() {
  const btn = el('button.btn.btn-ghost', {
    type: 'button',
    onclick: async () => {
      btn.disabled = true;
      btn.textContent = 'Vérification…';
      const result = await checkForUpdate();
      btn.disabled = false;
      btn.textContent = 'Vérifier les mises à jour';
      if (result === 'none') toast('MesZapply est à jour', { type: 'success' });
      if (result === 'unsupported') toast('Vérification impossible dans ce navigateur.', { type: 'error' });
    },
  }, 'Vérifier les mises à jour');
  return el('section.set-block', {}, [el('h3', {}, 'Mise à jour'), btn]);
}

// --- À propos ----------------------------------------------------------------------------
function aboutBlock() {
  return el('section.set-block.about', {}, [
    el('img.about-logo', { src: 'icons/icon-192.png', alt: '' }),
    el('div', {}, [
      el('p.about-name', {}, 'MesZapply'),
      el('p.muted.small', {}, `Version ${self.MZ_VERSION || '?'}`),
      el('p.small', {}, AUTHOR_LINE),
    ]),
  ]);
}
