// Petits outils d'interface partagés : création d'éléments, messages, fenêtres, émojis.

/** Crée un élément : el('div.card', { onclick }, [enfants]) */
export function el(tag, attrs = {}, children = []) {
  const [name, ...classes] = tag.split('.');
  const node = document.createElement(name || 'div');
  if (classes.length) node.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'html') node.innerHTML = v;
    else if (k in node && typeof v !== 'string') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const icons = {
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.6Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.2 12 4.5l8 6.7V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1v-7.8Z" fill="currentColor"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  move: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.5h14M5 12h14M5 16.5h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  grip: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m13.5 6.5 4 4" stroke="currentColor" stroke-width="1.8"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4l16 16M9.9 6A9.6 9.6 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-3 3.7M6.6 7.6A16.8 16.8 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.9-.4 4.1-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16m0 4v-4h-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" fill="currentColor"/></svg>',
  external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export function iconEl(name, cls = 'ico') {
  return el(`span.${cls}`, { html: icons[name] });
}

// --- Messages éphémères -------------------------------------------------------
export function toast(message, { type = 'info', action, actionLabel, duration = 3200 } = {}) {
  const root = document.getElementById('toasts');
  const node = el(`div.toast.toast-${type}`, { role: 'status' }, [el('span', {}, message)]);
  if (action) {
    node.append(el('button.toast-action', {
      type: 'button',
      onclick: () => { action(); dismiss(); },
    }, actionLabel || 'OK'));
  }
  root.append(node);
  requestAnimationFrame(() => node.classList.add('show'));
  let timer = duration > 0 ? setTimeout(dismiss, duration) : null;
  function dismiss() {
    clearTimeout(timer);
    node.classList.remove('show');
    setTimeout(() => node.remove(), 250);
  }
  return dismiss;
}

// --- Fenêtres (panneaux) -------------------------------------------------------
export function openSheet({ title, content, wide = false, onClose }) {
  const root = document.getElementById('modal-root');
  const panel = el(`div.sheet${wide ? '.sheet-wide' : ''}`, { role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const backdrop = el('div.sheet-backdrop', { onclick: e => { if (e.target === backdrop) close(); } }, [panel]);
  const head = el('div.sheet-head', {}, [
    el('h2', {}, title),
    el('button.icon-btn', { type: 'button', 'aria-label': 'Fermer', onclick: () => close(), html: icons.close }),
  ]);
  const body = el('div.sheet-body', {}, [content]);
  panel.append(head, body);
  root.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('show'));

  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    backdrop.classList.remove('show');
    setTimeout(() => backdrop.remove(), 220);
    if (onClose) onClose();
  }
  return { close, body, panel };
}

export function confirmDialog({ title, message, okLabel = 'Confirmer', danger = false }) {
  return new Promise(resolve => {
    let answered = false;
    const content = el('div.confirm', {}, [
      el('p', {}, message),
      el('div.row-actions', {}, [
        el('button.btn.btn-ghost', { type: 'button', onclick: () => finish(false) }, 'Annuler'),
        el(`button.btn${danger ? '.btn-danger' : '.btn-primary'}`, { type: 'button', onclick: () => finish(true) }, okLabel),
      ]),
    ]);
    const sheet = openSheet({ title, content, onClose: () => { if (!answered) resolve(false); } });
    function finish(value) { answered = true; sheet.close(); resolve(value); }
  });
}

// --- Champ émoji ---------------------------------------------------------------
const EMOJIS = [
  '🍳','🍲','🥗','🍕','🍰','🥖','🍷','🍺','☕','🥩','🔥','🧂',
  '🎲','🎮','🃏','🧩','🎯','🎬','📀','📚','🎵','🎨','🎁','🎄',
  '🌱','🌻','🥕','🍅','🌳','🍂','🐝','💧','☀️','🌦️','🐟','🐾',
  '🛠️','🔧','🔨','📏','🔋','💡','🔌','🧰','⚙️','🧪','📐','🖌️',
  '🏠','🧹','🧺','🛒','📅','⏰','📝','📋','💼','💶','📊','🗂️',
  '⚽','🏀','🎾','🚴','🏃','🏊','🥾','🏋️','⛳','🎣','🏆','🧘',
  '🚗','🛵','🚲','✈️','🗺️','⛺','🧳','🚆','📍','🧭','🏖️','⛰️',
  '❤️','💊','🩺','👶','🧸','🐶','🐱','👨‍👩‍👧','📷','📱','💻','⭐',
];

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('fr', { granularity: 'grapheme' }) : null;
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u;

/** Ne garde que le dernier émoji saisi (lettres et chiffres sont ignorés). */
export function onlyEmoji(text) {
  const parts = segmenter ? [...segmenter.segment(text)].map(s => s.segment) : Array.from(text);
  const emojis = parts.filter(p => EMOJI_RE.test(p));
  return emojis.length ? emojis[emojis.length - 1] : '';
}

/**
 * Champ réservé aux émojis + palette à cliquer (pratique sur PC).
 * Renvoie { wrap, input }.
 */
export function emojiField(value = '', { onChange } = {}) {
  const input = el('input.input.emoji-input', {
    type: 'text', value, inputmode: 'text', autocomplete: 'off',
    'aria-label': 'Émoji de la catégorie', placeholder: '🙂', maxlength: 16,
  });
  let last = value;
  input.addEventListener('input', () => {
    const e = onlyEmoji(input.value);
    input.value = e || (input.value === '' ? '' : last);
    last = input.value;
    onChange && onChange(input.value);
  });

  const palette = el('div.emoji-palette', { hidden: true });
  EMOJIS.forEach(em => palette.append(el('button.emoji-choice', {
    type: 'button',
    onclick: () => {
      input.value = em; last = em; palette.hidden = true;
      onChange && onChange(em);
    },
  }, em)));

  const toggle = el('button.icon-btn.emoji-toggle', {
    type: 'button', 'aria-label': 'Choisir un émoji',
    onclick: () => { palette.hidden = !palette.hidden; },
  }, '▾');

  const wrap = el('div.emoji-field', {}, [el('div.emoji-line', {}, [input, toggle]), palette]);
  return { wrap, input };
}

/** Initiales colorées quand une appli n'a pas d'icône. */
export function letterAvatar(name, color) {
  const letters = String(name).replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ')
    .slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  return el('span.app-letters', { style: color ? { background: color } : undefined }, letters);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
