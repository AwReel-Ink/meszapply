// Onglet « Gérer » : applis (ajout, modification, masquage, ordre, suppression)
// et catégories (création, renommage, ordre, suppression).
import { el, iconEl, icons, confirmDialog, emojiField, letterAvatar, toast } from './ui.js';
import * as store from './store.js';
import { save } from './actions.js';
import { openAppForm } from './appform.js';
import { makeSortable } from './sortable.js';
import { fetchAppMeta, displayIcon } from './meta.js';

let root;

export function initManage() {
  root = document.getElementById('view-manage');
}

export function renderManage(state) {
  if (!root) return;
  const { categories, apps } = state.data;
  root.replaceChildren();

  // --- Barre d'actions ---------------------------------------------------------
  const missingIcons = apps.filter(a => !a.icon).length;
  root.append(el('div.manage-actions', {}, [
    el('button.btn.btn-primary', { type: 'button', onclick: () => openAppForm() }, [iconEl('plus'), 'Ajouter une appli']),
    missingIcons ? el('button.btn.btn-ghost', { type: 'button', onclick: fillMissingIcons }, `Enregistrer les icônes manquantes (${missingIcons})`) : null,
  ]));

  // --- Applis par catégorie ------------------------------------------------------
  const appsSection = el('section.manage-block', {}, [
    el('h2.block-title', {}, 'Applis'),
    el('p.muted.small', {}, 'Glisse les poignées pour changer l\'ordre dans une catégorie. L\'œil masque une appli sans la supprimer.'),
  ]);
  const groups = [...categories.map(c => ({ ...c })), { id: '_none', name: 'Sans catégorie', emoji: '📁' }];
  const known = new Set(categories.map(c => c.id));
  for (const group of groups) {
    const list = group.id === '_none'
      ? apps.filter(a => !known.has(a.category))
      : apps.filter(a => a.category === group.id);
    if (group.id === '_none' && !list.length) continue;

    const ul = el('ul.manage-list');
    list.forEach(app => ul.append(appRow(app)));
    if (!list.length) ul.append(el('li.manage-empty', {}, 'Aucune appli dans cette catégorie'));
    appsSection.append(el('div.manage-group', {}, [
      el('h3.group-title', {}, [el('span', { 'aria-hidden': 'true' }, group.emoji), ` ${group.name}`, el('span.count', {}, ` · ${list.length}`)]),
      ul,
    ]));
    if (list.length > 1 && group.id !== '_none') {
      makeSortable(ul, { onDrop: ids => reorderApps(group.id, ids) });
    }
  }
  root.append(appsSection);

  // --- Catégories ----------------------------------------------------------------
  root.append(categoriesBlock(categories, apps));
}

function appRow(app) {
  const src = displayIcon(app);
  const icon = el('span.row-icon', {}, [src
    ? el('img', { src, alt: '', loading: 'lazy', onerror: e => e.target.replaceWith(letterAvatar(app.name, app.color)) })
    : letterAvatar(app.name, app.color)]);
  return el(`li.manage-row${app.hidden ? '.is-hidden' : ''}`, { dataset: { id: app.id } }, [
    el('button.grip', { type: 'button', 'aria-label': `Déplacer ${app.name}`, html: icons.grip }),
    icon,
    el('div.row-text', {}, [
      el('span.row-name', {}, [app.name, app.hidden ? el('span.tag', {}, 'masquée') : null, app.openMode === 'outside' ? el('span.tag', {}, 'à part') : null]),
      el('span.row-desc', {}, app.description || app.url),
    ]),
    el('div.row-buttons', {}, [
      el('button.icon-btn', {
        type: 'button',
        'aria-label': app.hidden ? `Afficher ${app.name}` : `Masquer ${app.name}`,
        title: app.hidden ? 'Afficher dans la galerie' : 'Masquer de la galerie',
        html: app.hidden ? icons.eyeOff : icons.eye,
        onclick: () => setHidden(app, !app.hidden),
      }),
      el('button.icon-btn', { type: 'button', 'aria-label': `Modifier ${app.name}`, title: 'Modifier', html: icons.edit, onclick: () => openAppForm(app) }),
      el('button.icon-btn.danger', { type: 'button', 'aria-label': `Supprimer ${app.name}`, title: 'Supprimer', html: icons.trash, onclick: () => removeApp(app) }),
    ]),
  ]);
}

export function setHidden(app, hidden) {
  return save(d => {
    const a = d.apps.find(x => x.id === app.id);
    if (a) a.hidden = hidden;
  }, `${hidden ? 'Masquage' : 'Affichage'} de l'appli ${app.name}`,
  hidden ? `${app.name} est masquée` : `${app.name} est de nouveau visible`);
}

async function removeApp(app) {
  const ok = await confirmDialog({
    title: 'Supprimer cette appli ?',
    message: `« ${app.name} » sera retirée de la galerie sur tous tes appareils. L'appli elle-même et son dépôt GitHub ne sont pas touchés. Pour la cacher seulement, utilise plutôt l'œil.`,
    okLabel: 'Supprimer',
    danger: true,
  });
  if (!ok) return;
  save(d => { d.apps = d.apps.filter(a => a.id !== app.id); },
    `Suppression de l'appli ${app.name}`, `${app.name} supprimée de la galerie`);
}

function reorderApps(catId, ids) {
  save(d => {
    const inCat = d.apps.filter(a => a.category === catId);
    const ordered = ids.map(id => inCat.find(a => a.id === id)).filter(Boolean);
    inCat.forEach(a => { if (!ordered.includes(a)) ordered.push(a); }); // ajoutée ailleurs entre-temps
    let k = 0;
    d.apps = d.apps.map(a => (a.category === catId ? ordered[k++] : a));
  }, 'Nouvel ordre des applis', 'Ordre enregistré');
}

async function fillMissingIcons() {
  const apps = store.getState().data.apps.filter(a => !a.icon);
  const dismiss = toast(`Recherche des icônes (${apps.length})…`, { duration: 0 });
  const found = {};
  await Promise.all(apps.map(async a => {
    try {
      const meta = await fetchAppMeta(a.url);
      if (meta.icon) found[a.id] = { icon: meta.icon, color: /^#[0-9a-f]{6}$/i.test(meta.color) ? meta.color.toLowerCase() : '' };
    } catch { /* appli injoignable */ }
  }));
  dismiss();
  const n = Object.keys(found).length;
  if (!n) { toast('Aucune icône trouvée. Vérifie que ces applis ont un manifest avec des icônes.', { type: 'error', duration: 5000 }); return; }
  save(d => {
    d.apps.forEach(a => {
      if (!a.icon && found[a.id]) { a.icon = found[a.id].icon; if (!a.color) a.color = found[a.id].color; }
    });
  }, `Ajout des icônes manquantes (${n})`, `${n} icône${n > 1 ? 's' : ''} enregistrée${n > 1 ? 's' : ''}`);
}

// --- Catégories -------------------------------------------------------------------
function categoriesBlock(categories, apps) {
  const block = el('section.manage-block', {}, [
    el('h2.block-title', {}, 'Catégories'),
    el('p.muted.small', {}, 'Une catégorie vide n\'apparaît pas dans la galerie.'),
  ]);

  // Création : nom + émoji
  const nameInput = el('input.input', { type: 'text', placeholder: 'Nom de la catégorie', maxlength: 30, 'aria-label': 'Nom de la catégorie' });
  const emoji = emojiField('');
  const form = el('form.cat-form', {
    onsubmit: e => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const em = emoji.input.value;
      if (!name) { toast('Donne un nom à la catégorie.', { type: 'error' }); nameInput.focus(); return; }
      if (!em) { toast('Choisis un émoji pour la catégorie.', { type: 'error' }); emoji.input.focus(); return; }
      if (store.getState().data.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        toast('Cette catégorie existe déjà.', { type: 'error' }); return;
      }
      save(d => {
        d.categories.push({ id: store.uniqueId(name, d.categories.map(c => c.id)), name, emoji: em });
      }, `Création de la catégorie ${name}`, `Catégorie « ${name} » créée`);
    },
  }, [nameInput, emoji.wrap, el('button.btn.btn-primary', { type: 'submit' }, 'Créer')]);
  block.append(form);

  const ul = el('ul.manage-list');
  categories.forEach(cat => ul.append(categoryRow(cat, apps.filter(a => a.category === cat.id).length)));
  block.append(ul);
  if (categories.length > 1) {
    makeSortable(ul, {
      onDrop: ids => save(d => {
        const ordered = ids.map(id => d.categories.find(c => c.id === id)).filter(Boolean);
        d.categories.forEach(c => { if (!ordered.includes(c)) ordered.push(c); });
        d.categories = ordered;
      }, 'Nouvel ordre des catégories', 'Ordre des catégories enregistré'),
    });
  }
  return block;
}

function categoryRow(cat, count) {
  const li = el('li.manage-row.cat-row', { dataset: { id: cat.id } });
  const view = () => {
    li.replaceChildren(
      el('button.grip', { type: 'button', 'aria-label': `Déplacer ${cat.name}`, html: icons.grip }),
      el('span.cat-row-emoji', { 'aria-hidden': 'true' }, cat.emoji),
      el('div.row-text', {}, [
        el('span.row-name', {}, cat.name),
        el('span.row-desc', {}, count ? `${count} appli${count > 1 ? 's' : ''}` : 'vide'),
      ]),
      el('div.row-buttons', {}, [
        el('button.icon-btn', { type: 'button', 'aria-label': `Renommer ${cat.name}`, title: 'Renommer', html: icons.edit, onclick: edit }),
        el('button.icon-btn.danger', { type: 'button', 'aria-label': `Supprimer ${cat.name}`, title: 'Supprimer', html: icons.trash, onclick: remove }),
      ]),
    );
  };
  const edit = () => {
    const nameInput = el('input.input', { type: 'text', value: cat.name, maxlength: 30, 'aria-label': 'Nom de la catégorie' });
    const emoji = emojiField(cat.emoji);
    const form = el('form.cat-form.cat-edit', {
      onsubmit: e => {
        e.preventDefault();
        const name = nameInput.value.trim();
        const em = emoji.input.value || cat.emoji;
        if (!name) { nameInput.focus(); return; }
        save(d => {
          const c = d.categories.find(x => x.id === cat.id);
          if (c) { c.name = name; c.emoji = em; }
        }, `Renommage de la catégorie ${cat.name} en ${name}`, 'Catégorie enregistrée');
      },
    }, [
      nameInput, emoji.wrap,
      el('button.btn.btn-primary.btn-small', { type: 'submit' }, 'Enregistrer'),
      el('button.btn.btn-ghost.btn-small', { type: 'button', onclick: view }, 'Annuler'),
    ]);
    li.replaceChildren(form);
    nameInput.focus();
  };
  const remove = async () => {
    if (count) {
      toast(`« ${cat.name} » contient ${count} appli${count > 1 ? 's' : ''}. Déplace-les d'abord dans une autre catégorie.`, { type: 'error', duration: 5000 });
      return;
    }
    const ok = await confirmDialog({ title: 'Supprimer la catégorie ?', message: `La catégorie « ${cat.name} » sera supprimée.`, okLabel: 'Supprimer', danger: true });
    if (!ok) return;
    save(d => {
      if (d.apps.some(a => a.category === cat.id)) throw new Error(`« ${cat.name} » contient des applis ajoutées depuis un autre appareil. Déplace-les d'abord.`);
      d.categories = d.categories.filter(c => c.id !== cat.id);
    }, `Suppression de la catégorie ${cat.name}`, `Catégorie « ${cat.name} » supprimée`);
  };
  view();
  return li;
}
