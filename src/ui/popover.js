/**
 * In-window child panels: menus, pick lists, confirmations, and short text prompts that open beside
 * the control that asked for them, inside the same themed window. Replaces Foundry's centered dialog
 * windows for quick choices. See docs/SCOPE.md 7.4b.
 *
 * Each panel closes on Esc, on a click outside, or when its window closes, and returns focus to the
 * control that opened it. Only one is open per window. Activating the same control again closes it.
 */

const escape = (value) => foundry.utils.escapeHTML(String(value ?? ''));

/** @type {WeakMap<HTMLElement, { done: Function, anchor: unknown }>} Each window's open panel: its close function and opener. */
const openPanels = new WeakMap();

/**
 * Opens a panel and resolves when it closes.
 *
 * @param {foundry.applications.api.ApplicationV2|HTMLElement} app - The window the panel belongs to, or a
 *   themed element (the Quest Beacon) to attach it to.
 * @param {HTMLElement|{ x: number, y: number }} anchor - The control that opened it, or a pointer position.
 * @param {string} html - Panel content.
 * @param {(panel: HTMLElement, done: Function) => void} wire - Attaches behavior; call `done(value)` to close.
 * @param {{ label: string, role?: string }} options - Accessible label and ARIA role.
 * @returns {Promise<unknown>} The value passed to `done`, or null if dismissed.
 */
export function openPanel(app, anchor, html, wire, { label, role = 'dialog' })
{
   const host = app instanceof HTMLElement ? app : app.element;
   const fixed = app instanceof HTMLElement;
   const open = openPanels.get(host);
   open?.done(null);
   // The same control again is a toggle: the open panel is closed and nothing reopens.
   if (open && anchor instanceof HTMLElement && open.anchor === anchor) { return Promise.resolve(null); }

   const returnFocus = anchor instanceof HTMLElement ? anchor : document.activeElement;
   const panel = document.createElement('div');
   panel.className = 'fhql-popover';
   panel.setAttribute('role', role);
   panel.setAttribute('aria-label', label);
   panel.innerHTML = html;
   // A Beacon panel goes on the page itself: a transformed ancestor (Foundry's UI, the Beacon's own
   // motion) would otherwise become the reference for its fixed position and throw it off-screen.
   const shell = fixed ? floatingShell(host) : null;
   (shell ?? host).append(panel);
   if (shell) { document.body.append(shell); positionInViewport(panel, anchor); }
   else { position(panel, host, anchor); }

   return new Promise((resolve) =>
   {
      let closed = false;
      const done = (value) =>
      {
         if (closed) { return; }
         closed = true;
         document.removeEventListener('pointerdown', onOutside, true);
         panel.remove();
         shell?.remove();
         openPanels.delete(host);
         if (returnFocus?.isConnected) { returnFocus.focus(); }
         resolve(value);
      };
      // A press on the opener is left to its click, which closes the panel as a toggle.
      const onOutside = (event) =>
      {
         if (panel.contains(event.target)) { return; }
         if (anchor instanceof HTMLElement && anchor.contains(event.target)) { return; }
         done(null);
      };

      panel.addEventListener('keydown', (event) =>
      {
         if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); done(null); }
      });
      document.addEventListener('pointerdown', onOutside, true);
      openPanels.set(host, { done, anchor });
      wire(panel, done);
      (panel.querySelector('[autofocus]') ?? panel.querySelector('button, input, select'))?.focus();
   });
}

/**
 * Places the panel beside its anchor, inside the window: below and right-aligned by preference,
 * flipped above when there's no room below, and clamped to the window's edges.
 *
 * @param {HTMLElement} panel - The panel.
 * @param {HTMLElement} host - The window element.
 * @param {HTMLElement|{ x: number, y: number }} anchor - Control or pointer position.
 */
function position(panel, host, anchor)
{
   const box = host.getBoundingClientRect();
   const a = anchor instanceof HTMLElement
    ? anchor.getBoundingClientRect()
    : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
   const p = panel.getBoundingClientRect();
   const margin = 6;

   let left = (anchor instanceof HTMLElement ? a.right - p.width : a.left) - box.left;
   left = Math.min(Math.max(left, margin), box.width - p.width - margin);

   let top = a.bottom - box.top + 4;
   if (top + p.height > box.height - margin) { top = a.top - box.top - p.height - 4; }
   top = Math.min(Math.max(top, margin), Math.max(margin, box.height - p.height - margin));

   panel.style.left = `${left}px`;
   panel.style.top = `${top}px`;
}

/**
 * A themed, empty holder on the page for a floating panel: the host's theme classes and its inline
 * theme settings (texture strength, fonts, banner color), so the panel looks like its host.
 *
 * @param {HTMLElement} host - The element the panel belongs to (the Beacon).
 * @returns {HTMLElement} The holder.
 */
function floatingShell(host)
{
   const shell = document.createElement('div');
   const themed = [...host.classList].filter((c) => c === 'fhql-app' || /^fhql-(theme-|no-texture|portrait-)/.test(c) || /^theme-/.test(c));
   shell.className = [...themed, 'fhql-floating'].join(' ');
   shell.style.cssText = host.style.cssText;
   return shell;
}

/**
 * Places a panel attached to a small element (the Beacon) against the screen instead of a window:
 * above the anchor by preference, since the Beacon sits at the bottom of the screen.
 *
 * @param {HTMLElement} panel - The panel.
 * @param {HTMLElement} anchor - The control that opened it.
 */
function positionInViewport(panel, anchor)
{
   const a = anchor.getBoundingClientRect();
   panel.style.position = 'fixed';
   const p = panel.getBoundingClientRect();
   const margin = 8;
   let top = a.top - p.height - 4;
   if (top < margin) { top = Math.min(a.bottom + 4, window.innerHeight - p.height - margin); }
   const left = Math.min(Math.max(a.left, margin), window.innerWidth - p.width - margin);
   panel.style.left = `${left}px`;
   panel.style.top = `${Math.max(margin, top)}px`;
}

/** Moves focus between a panel's items with the arrow keys, Home, and End. */
function arrowKeys(panel, selector)
{
   panel.addEventListener('keydown', (event) =>
   {
      const items = [...panel.querySelectorAll(selector)];
      const index = items.indexOf(document.activeElement);
      const move = { ArrowDown: 1, ArrowUp: -1 }[event.key];
      if (move) { event.preventDefault(); items[(index + move + items.length) % items.length]?.focus(); }
      else if (event.key === 'Home') { event.preventDefault(); items[0]?.focus(); }
      else if (event.key === 'End') { event.preventDefault(); items.at(-1)?.focus(); }
   });
}

/**
 * A menu or pick list: clicking an item chooses it.
 *
 * @param {object} app - Owning window.
 * @param {HTMLElement|{ x: number, y: number }} anchor - Control or pointer position.
 * @param {object} options - Menu options.
 * @param {string} [options.title] - Heading shown above the items.
 * @param {{ value: string, label: string, icon?: string, hint?: string, current?: boolean, danger?: boolean }[]} options.items - Items.
 * @returns {Promise<string|null>} The chosen value.
 */
export function menuPopover(app, anchor, { title, items })
{
   const html = `${title ? `<div class="fhql-popover-title">${escape(title)}</div>` : ''}
     <div class="fhql-popover-items">${items.map((item) => `
       <button type="button" role="menuitem" class="fhql-popover-item ${item.danger ? 'fhql-danger' : ''} ${item.current ? 'is-current' : ''}"
               data-value="${escape(item.value)}" ${item.current ? 'aria-current="true"' : ''}>
         <i class="${escape(item.icon ?? (item.current ? 'fa-solid fa-check' : ''))}" inert></i>
         <span>${escape(item.label)}${item.hint ? `<small>${escape(item.hint)}</small>` : ''}</span>
       </button>`).join('')}</div>`;

   return openPanel(app, anchor, html, (panel, done) =>
   {
      arrowKeys(panel, '.fhql-popover-item');
      panel.addEventListener('click', (event) =>
      {
         const item = event.target.closest('.fhql-popover-item');
         if (item) { done(item.dataset.value); }
      });
      const current = panel.querySelector('.is-current');
      if (current) { current.setAttribute('autofocus', ''); }
   }, { label: title ?? '', role: 'menu' });
}

/**
 * A yes/no (or yes/no/cancel) question.
 *
 * @param {object} app - Owning window.
 * @param {HTMLElement} anchor - The control that asked.
 * @param {object} options - Question options.
 * @param {string} options.message - Question, as HTML (escape any user text first).
 * @param {string} options.yes - Label for the confirming button.
 * @param {string} [options.no] - Label for a second answer that resolves false. Omit for yes/cancel.
 * @param {boolean} [options.danger] - Style the confirming button as destructive.
 * @returns {Promise<boolean|null>} true for yes, false for no, null if cancelled.
 */
export function confirmPopover(app, anchor, { message, yes, no, danger = false })
{
   const cancel = game.i18n.localize('FHQL.Popover.Cancel');
   const html = `<div class="fhql-popover-message">${message}</div>
     <div class="fhql-popover-buttons">
       <button type="button" class="fhql-button" data-answer="cancel">${escape(cancel)}</button>
       ${no ? `<button type="button" class="fhql-button" data-answer="no">${escape(no)}</button>` : ''}
       <button type="button" class="fhql-button ${danger ? 'fhql-danger-fill' : 'fhql-primary'}" data-answer="yes" autofocus>${escape(yes)}</button>
     </div>`;

   return openPanel(app, anchor, html, (panel, done) =>
   {
      panel.addEventListener('click', (event) =>
      {
         const answer = event.target.closest('[data-answer]')?.dataset.answer;
         if (answer) { done(answer === 'yes' ? true : answer === 'no' ? false : null); }
      });
   }, { label: yes, role: 'alertdialog' });
}

/**
 * A one-line text prompt.
 *
 * @param {object} app - Owning window.
 * @param {HTMLElement} anchor - The control that asked.
 * @param {object} options - Prompt options.
 * @param {string} options.label - Field label.
 * @param {string} [options.value] - Starting text.
 * @param {string} options.ok - Confirming button label.
 * @returns {Promise<string|null>} The text, or null if cancelled.
 */
export function inputPopover(app, anchor, { label, value = '', ok })
{
   const cancel = game.i18n.localize('FHQL.Popover.Cancel');
   const html = `<form class="fhql-popover-form">
       <label class="fhql-field"><span>${escape(label)}</span>
         <input type="text" class="fhql-input" name="value" value="${escape(value)}" autofocus></label>
       <div class="fhql-popover-buttons">
         <button type="button" class="fhql-button" data-answer="cancel">${escape(cancel)}</button>
         <button type="submit" class="fhql-button fhql-primary">${escape(ok)}</button>
       </div></form>`;

   return openPanel(app, anchor, html, (panel, done) =>
   {
      const form = panel.querySelector('form');
      const input = form.elements.value;
      input.select();
      form.addEventListener('submit', (event) => { event.preventDefault(); done(input.value.trim() || null); });
      panel.addEventListener('click', (event) => { if (event.target.closest('[data-answer="cancel"]')) { done(null); } });
   }, { label });
}

/**
 * Pick one option from a list and confirm it: a labelled dropdown and a confirming button. Used when
 * a choice must be confirmed even when there is only one option (who receives a reward).
 *
 * @param {object} app - Owning window.
 * @param {HTMLElement} anchor - The control that asked.
 * @param {object} options - Panel options.
 * @param {string} options.title - Heading.
 * @param {string} options.label - Dropdown label.
 * @param {string[]} options.choices - Option labels.
 * @param {number} [options.start] - Index selected at first.
 * @param {string} options.ok - Confirming button label.
 * @returns {Promise<number|null>} The chosen index, or null if cancelled.
 */
export function choicePanel(app, anchor, { title, label, choices, start = 0, ok })
{
   const cancel = game.i18n.localize('FHQL.Popover.Cancel');
   const html = `<form class="fhql-popover-form">
       <div class="fhql-popover-title">${escape(title)}</div>
       <label class="fhql-field"><span>${escape(label)}</span>
         <select class="fhql-input" name="choice" autofocus>${choices.map((c, i) =>
            `<option value="${i}" ${i === start ? 'selected' : ''}>${escape(c)}</option>`).join('')}</select></label>
       <div class="fhql-popover-buttons">
         <button type="button" class="fhql-button" data-answer="cancel">${escape(cancel)}</button>
         <button type="submit" class="fhql-button fhql-primary">${escape(ok)}</button>
       </div></form>`;

   return openPanel(app, anchor, html, (panel, done) =>
   {
      const form = panel.querySelector('form');
      form.addEventListener('submit', (event) => { event.preventDefault(); done(Number(form.elements.choice.value)); });
      panel.addEventListener('click', (event) => { if (event.target.closest('[data-answer="cancel"]')) { done(null); } });
   }, { label: title });
}
