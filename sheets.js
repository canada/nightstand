export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountDialog(dialog, closeButton) {
  document.body.append(dialog);
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      dialog.close();
  });
}

export function createSheet({ name, eyebrow, title, contentId }) {
  const dialog = element('dialog', 'sheet');
  dialog.id = `${name}Dialog`;
  dialog.setAttribute('aria-labelledby', `${name}Title`);
  dialog.innerHTML = `<header class="sheet-header"><div><p class="eyebrow">${eyebrow}</p><h2 id="${name}Title">${title}</h2></div><button type="button" class="close-btn" data-close aria-label="閉じる">×</button></header><div id="${contentId}"></div>`;
  mountDialog(dialog, dialog.querySelector('[data-close]'));
  return dialog;
}

export function makeTrigger(node, label, open) {
  node.setAttribute('role', 'button');
  node.tabIndex = 0;
  node.setAttribute('aria-label', label);
  node.setAttribute('aria-haspopup', 'dialog');
  node.addEventListener('click', open);
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      open();
    }
  });
}

export function protectDialogGestures() {
  for (const type of ['touchstart', 'touchmove', 'touchend']) {
    document.addEventListener(
      type,
      (event) => {
        if (event.target.closest('dialog')) event.stopPropagation();
      },
      { capture: true, passive: true }
    );
  }
  document.addEventListener(
    'keydown',
    (event) => {
      if (document.querySelector('dialog[open]')) event.stopPropagation();
    },
    true
  );
}
