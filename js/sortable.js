// Glisser-déposer pour réordonner une liste (souris et tactile).
// On attrape un élément par sa poignée, on le fait glisser, la liste se
// réorganise en direct ; au lâcher, onDrop reçoit le nouvel ordre des id.

export function makeSortable(list, { item = '[data-id]', handle = '.grip', onDrop }) {
  let dragged = null, startOrder = '', pointerId = null, scrollRaf = null, lastY = 0;

  list.addEventListener('pointerdown', e => {
    const h = e.target.closest(handle);
    if (!h || !list.contains(h)) return;
    const it = h.closest(item);
    if (!it || it.parentElement !== list) return;
    e.preventDefault();
    dragged = it;
    pointerId = e.pointerId;
    startOrder = order().join('|');
    lastY = e.clientY;
    h.setPointerCapture(pointerId);
    dragged.classList.add('sorting');
    list.classList.add('is-sorting');
    autoScroll();
  });

  list.addEventListener('pointermove', e => {
    if (!dragged || e.pointerId !== pointerId) return;
    lastY = e.clientY;
    const siblings = [...list.querySelectorAll(`:scope > ${item}`)].filter(n => n !== dragged);
    for (const sib of siblings) {
      const r = sib.getBoundingClientRect();
      if (e.clientY > r.top && e.clientY < r.bottom) {
        const before = e.clientY < r.top + r.height / 2;
        const ref = before ? sib : sib.nextElementSibling;
        if (ref !== dragged && dragged.nextElementSibling !== ref) list.insertBefore(dragged, ref);
        break;
      }
    }
  });

  const end = e => {
    if (!dragged || (e && e.pointerId !== pointerId)) return;
    cancelAnimationFrame(scrollRaf);
    dragged.classList.remove('sorting');
    list.classList.remove('is-sorting');
    dragged = null;
    const now = order();
    if (now.join('|') !== startOrder) onDrop(now);
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);

  // Défilement automatique quand on approche du haut ou du bas de l'écran
  function autoScroll() {
    if (!dragged) return;
    const edge = 70, H = window.innerHeight;
    const scroller = list.closest('.scroll-area') || document.scrollingElement;
    if (lastY < edge) scroller.scrollBy(0, -8);
    else if (lastY > H - edge) scroller.scrollBy(0, 8);
    scrollRaf = requestAnimationFrame(autoScroll);
  }

  function order() {
    return [...list.querySelectorAll(`:scope > ${item}`)].map(n => n.dataset.id);
  }
}
