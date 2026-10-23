// Formulaire « Ajouter / Modifier une appli ».
import { el, openSheet, toast, letterAvatar, iconEl } from './ui.js';
import * as store from './store.js';
import * as gh from './github.js';
import { REPO } from './config.js';
import { normalizeUrl, repoFromUrl, repoToUrl, checkLink, fetchAppMeta } from './meta.js';
import { save } from './actions.js';

let repoCache = null; // dépôts GitHub (gardés le temps de la session)

async function loadRepos() {
  if (repoCache) return repoCache;
  repoCache = await gh.listRepos(store.getState().token);
  return repoCache;
}

/** Ouvre le formulaire. Sans `app` : ajout. Avec `app` : modification. */
export function openAppForm(app = null) {
  const editing = !!app;
  const { data } = store.getState();
  const values = app ? { ...app } : {
    id: '', name: '', description: '', url: '', repo: '', icon: '', color: '',
    category: data.categories[0]?.id || '', hidden: false, openMode: 'inside',
  };
  const dirty = new Set();   // champs modifiés à la main : la lecture auto ne les écrase plus
  let linkOk = editing;      // en modification, le lien a déjà été vérifié
  let checkToken = 0;

  // --- Champs ---------------------------------------------------------------
  const urlInput = el('input.input', { type: 'url', placeholder: 'https://awreel-ink.github.io/MonAppli/', value: values.url, autocomplete: 'off', spellcheck: false });
  const nameInput = el('input.input', { type: 'text', value: values.name, maxlength: 40, placeholder: 'Nom affiché' });
  const descInput = el('textarea.input', { rows: 3, maxlength: 240, placeholder: 'Une phrase pour dire à quoi sert l\'appli' }, values.description);
  const catSelect = el('select.input');
  data.categories.forEach(c => catSelect.append(el('option', { value: c.id, selected: c.id === values.category }, `${c.emoji}  ${c.name}`)));
  if (!data.categories.length) catSelect.append(el('option', { value: '' }, 'Aucune catégorie : crées-en une dans « Gérer »'));
  const iconInput = el('input.input', { type: 'url', value: values.icon, placeholder: 'Trouvée automatiquement', spellcheck: false });
  const colorInput = el('input.color-input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(values.color) ? values.color : '#5b7cfa', 'aria-label': 'Couleur de l\'appli' });
  const modeInside = el('input', { type: 'radio', name: 'openMode', value: 'inside', checked: values.openMode !== 'outside' });
  const modeOutside = el('input', { type: 'radio', name: 'openMode', value: 'outside', checked: values.openMode === 'outside' });

  const linkStatus = el('p.link-status', { 'aria-live': 'polite' });
  const previewIcon = el('span.app-icon');
  const previewName = el('span.app-name');
  const previewDesc = el('span.app-desc');
  const preview = el('div.app-card.preview', {}, [previewIcon, el('span.app-text', {}, [previewName, previewDesc])]);

  [nameInput, descInput, iconInput].forEach(inp => inp.addEventListener('input', () => { dirty.add(inp); refreshPreview(); }));
  colorInput.addEventListener('input', () => { dirty.add(colorInput); refreshPreview(); });

  function refreshPreview() {
    previewName.textContent = nameInput.value || 'Nom de l\'appli';
    previewDesc.textContent = descInput.value || 'Description';
    preview.style.setProperty('--app-color', colorInput.value);
    previewIcon.replaceChildren(iconInput.value
      ? el('img', { src: iconInput.value, alt: '', onerror: () => previewIcon.replaceChildren(letterAvatar(nameInput.value || '?', colorInput.value)) })
      : letterAvatar(nameInput.value || '?', colorInput.value));
  }

  function setField(input, value) {
    if (!value) return;
    if (dirty.has(input) && input.value.trim()) return; // ne jamais écraser une saisie
    input.value = value;
  }
  // En modification, les valeurs existantes sont considérées comme choisies par toi
  if (editing) [nameInput, descInput, iconInput, colorInput].forEach(i => dirty.add(i));

  // --- Lecture automatique à partir du lien ------------------------------------
  async function readFromLink({ force = false, repoInfo = null } = {}) {
    const url = normalizeUrl(urlInput.value);
    if (!url) { linkOk = false; setStatus('error', 'Colle l\'adresse de l\'appli (ou du dépôt GitHub).'); return; }
    urlInput.value = url;
    const my = ++checkToken;
    linkOk = false;
    setStatus('wait', 'Vérification du lien…');
    if (force === 'all') dirty.clear();
    if (force === 'visual') { dirty.delete(iconInput); dirty.delete(colorInput); }

    const [check, meta] = await Promise.all([checkLink(url), fetchAppMeta(url).catch(() => ({}))]);
    if (my !== checkToken) return; // une autre vérification a pris le relais

    if (!check.ok) { setStatus('error', check.message); return; }
    linkOk = true;
    setStatus('ok', check.unverified ? 'Le site répond (contenu non lisible : remplis les champs à la main).' : 'La page répond. Infos récupérées depuis l\'appli.');

    const repoName = repoInfo?.name || repoFromUrl(url);
    let repoDesc = repoInfo?.description || '';
    if (!repoDesc && repoName && repoCache) repoDesc = repoCache.find(r => r.name.toLowerCase() === repoName.toLowerCase())?.description || '';

    setField(nameInput, meta.name || repoName);
    setField(descInput, repoDesc || meta.description);
    setField(iconInput, meta.icon);
    if (meta.color && /^#[0-9a-f]{6}$/i.test(meta.color)) setField(colorInput, meta.color.toLowerCase());
    values.repo = repoName;
    refreshPreview();
  }

  function setStatus(kind, text) {
    linkStatus.className = `link-status is-${kind}`;
    linkStatus.textContent = text;
    forceBtn.hidden = kind !== 'error' || !normalizeUrl(urlInput.value);
  }

  urlInput.addEventListener('change', () => readFromLink());
  urlInput.addEventListener('paste', () => setTimeout(() => readFromLink(), 30));

  // --- Liste des dépôts (ajout uniquement) ------------------------------------
  const repoBox = el('div.repo-box');
  if (!editing) {
    repoBox.append(el('p.muted', {}, 'Recherche de tes applis publiées sur GitHub…'));
    loadRepos().then(repos => {
      const inGallery = new Set(data.apps.map(a => (a.repo || repoFromUrl(a.url)).toLowerCase()));
      const urls = new Set(data.apps.map(a => a.url.toLowerCase()));
      const candidates = repos.filter(r => r.has_pages
        && r.name.toLowerCase() !== REPO.toLowerCase()
        && !inGallery.has(r.name.toLowerCase())
        && !urls.has(repoToUrl(r.name).toLowerCase()));
      repoBox.replaceChildren();
      if (!candidates.length) {
        repoBox.append(el('p.muted', {}, 'Toutes tes applis publiées sont déjà dans la galerie. Tu peux quand même coller un lien ci-dessous.'));
        return;
      }
      repoBox.append(el('p.field-label', {}, 'Tes applis publiées pas encore dans la galerie'));
      const list = el('div.repo-list');
      candidates.forEach(r => {
        const chip = el('button.repo-chip', { type: 'button' },
          [el('strong', {}, r.name), r.description ? el('span', {}, r.description) : null]);
        chip.addEventListener('click', () => {
          list.querySelectorAll('.repo-chip').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
          urlInput.value = repoToUrl(r.name);
          readFromLink({ force: 'all', repoInfo: r });
        });
        list.append(chip);
      });
      repoBox.append(list);
    }).catch(err => {
      repoBox.replaceChildren(el('p.muted', {}, `Liste des dépôts indisponible (${err.message}). Colle simplement le lien ci-dessous.`));
    });
  }

  // --- Boutons ----------------------------------------------------------------
  const submitBtn = el('button.btn.btn-primary', { type: 'submit' }, editing ? 'Enregistrer' : 'Ajouter à la galerie');
  const forceBtn = el('button.btn.btn-ghost.btn-small', { type: 'button', hidden: true, onclick: () => submit(true) }, 'Enregistrer quand même');
  const rereadBtn = el('button.btn.btn-ghost.btn-small', { type: 'button', onclick: () => readFromLink({ force: 'visual' }) }, [iconEl('refresh'), 'Relire l\'icône']);

  const form = el('form.app-form', {
    onsubmit: e => { e.preventDefault(); submit(false); },
  }, [
    editing ? null : repoBox,
    field('Lien de l\'appli', el('div.input-row', {}, [urlInput, rereadBtn]), 'Adresse de la page publiée, ou lien du dépôt GitHub : les deux fonctionnent.'),
    el('div.link-line', {}, [linkStatus, forceBtn]),
    el('p.field-label', {}, 'Aperçu'),
    preview,
    field('Nom', nameInput),
    field('Description', descInput),
    field('Catégorie', catSelect),
    el('div.two-cols', {}, [
      field('Icône (adresse)', iconInput),
      field('Couleur', colorInput),
    ]),
    el('fieldset.field', {}, [
      el('legend.field-label', {}, 'Ouverture'),
      el('label.radio', {}, [modeInside, el('span', {}, 'Dans MesZapply (avec la bulle)')]),
      el('label.radio', {}, [modeOutside, el('span', {}, 'À part, dans un nouvel onglet')]),
    ]),
    el('div.row-actions.sticky-actions', {}, [
      el('button.btn.btn-ghost', { type: 'button', onclick: () => sheet.close() }, 'Annuler'),
      submitBtn,
    ]),
  ]);

  const sheet = openSheet({ title: editing ? `Modifier ${app.name}` : 'Ajouter une appli', content: form, wide: true });
  refreshPreview();
  if (editing) setStatus('ok', 'Lien déjà vérifié. Modifie-le pour le vérifier à nouveau.');
  urlInput.addEventListener('input', () => { linkOk = false; });

  async function submit(force) {
    const url = normalizeUrl(urlInput.value);
    const name = nameInput.value.trim();
    if (!url) { setStatus('error', 'Le lien est obligatoire.'); urlInput.focus(); return; }
    if (!name) { toast('Donne un nom à l\'appli.', { type: 'error' }); nameInput.focus(); return; }
    if (!catSelect.value) { toast('Choisis une catégorie (crée-en une dans « Gérer » si besoin).', { type: 'error' }); return; }
    const duplicate = store.getState().data.apps.find(a => a.url.toLowerCase() === url.toLowerCase() && a.id !== values.id);
    if (duplicate) { setStatus('error', `Ce lien est déjà utilisé par « ${duplicate.name} ».`); return; }

    if (!linkOk && !force) {
      await readFromLink();
      if (!linkOk) return;
    }

    const entry = {
      id: values.id,
      name,
      description: descInput.value.trim(),
      url,
      repo: values.repo || repoFromUrl(url),
      icon: iconInput.value.trim(),
      color: colorInput.value,
      category: catSelect.value,
      hidden: !!values.hidden,
      openMode: modeOutside.checked ? 'outside' : 'inside',
    };

    submitBtn.disabled = true;
    const ok = await save(d => {
      if (editing) {
        const i = d.apps.findIndex(a => a.id === entry.id);
        if (i < 0) throw new Error('Cette appli a été supprimée depuis un autre appareil.');
        d.apps[i] = entry;
      } else {
        entry.id = store.uniqueId(entry.repo || entry.name, d.apps.map(a => a.id));
        d.apps.push(entry);
      }
    }, editing ? `Modification de l'appli ${name}` : `Ajout de l'appli ${name}`,
    editing ? `${name} enregistrée` : `${name} ajoutée à la galerie`);
    submitBtn.disabled = false;
    if (ok) sheet.close();
  }
}

function field(label, control, help) {
  return el('label.field', {}, [
    el('span.field-label', {}, label),
    control,
    help ? el('span.field-help', {}, help) : null,
  ]);
}
