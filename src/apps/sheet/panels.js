/**
 * Quest sheet: panel sizing and scrolling. See docs/SCOPE.md 7.4c.
 *
 * Wide sheets (two columns): the header stays pinned and the body fills the rest. Each panel
 * (Description, Player notes, Objectives, Subquests, Rewards) is never taller than its contents and
 * scrolls on its own when its column runs out of room. Every panel first gets a minimum (its contents
 * or about four rows, whichever is smaller); leftover height then goes out per column:
 * - right column, in priority order: Objectives, then Subquests, then Rewards;
 * - left column: Description and Player notes, in proportion to what each still needs.
 * If the minimums alone don't fit, the body takes that height and the whole sheet scrolls (last
 * resort; the header stays pinned).
 *
 * CSS can't express "Objectives first" (flexbox shrinks by content size), so this measures after each
 * render and whenever the window or a panel's contents change size.
 *
 * Narrow sheets (one column): one scroll, panels collapse by their heading, long objective lists are
 * cut short with "Show all". No nested scrolling there.
 */

/** About four rows of text, in em, as the smallest a long panel shrinks to. */
const MIN_ROWS_EM = 5.5;

/** Pixels of slack per column so rounding never clips the last panel's border. */
const SLACK = 4;

/** @param {HTMLElement} root - The sheet window element. @returns {HTMLElement|null} The sheet body. */
const sheetBody = (root) => root?.querySelector('.fhql-sheet-body') ?? null;

/**
 * @param {HTMLElement} root - The sheet window element.
 * @returns {boolean} Whether the sheet is in its one-column layout (columns dissolved by CSS).
 */
export function isNarrow(root)
{
   const col = sheetBody(root)?.querySelector('.fhql-col');
   return !col || getComputedStyle(col).display === 'contents';
}

/* ---------- Scroll positions ---------- */

/**
 * @param {HTMLElement} root - The sheet window element.
 * @returns {Record<string, number>} Each panel's scroll position, and the sheet's own.
 */
export function capturePanelScroll(root)
{
   const keep = {};
   for (const el of root?.querySelectorAll('[data-scroll]') ?? []) { keep[el.dataset.scroll] = el.scrollTop; }
   const sheet = root?.querySelector('.fhql-sheet');
   if (sheet) { keep['@sheet'] = sheet.scrollTop; }
   return keep;
}

/**
 * Puts panels back where they were, so ticking objective 150 doesn't jump the list to the top.
 *
 * @param {HTMLElement} root - The sheet window element.
 * @param {Record<string, number>|null} keep - From capturePanelScroll.
 */
export function restorePanelScroll(root, keep)
{
   if (!keep) { return; }
   for (const el of root?.querySelectorAll('[data-scroll]') ?? [])
   {
      if (keep[el.dataset.scroll] !== undefined) { el.scrollTop = keep[el.dataset.scroll]; }
   }
   const sheet = root?.querySelector('.fhql-sheet');
   if (sheet && keep['@sheet'] !== undefined) { sheet.scrollTop = keep['@sheet']; }
}

/* ---------- Sizing ---------- */

/**
 * @param {HTMLElement} card - A panel.
 * @returns {{ card: HTMLElement, natural: number, min: number }} Its content height and minimum.
 */
function measure(card)
{
   card.style.flexBasis = '';
   const natural = card.offsetHeight;
   const body = card.querySelector(':scope > .fhql-panel-body');
   if (!body) { return { card, natural, min: natural }; }
   const chrome = natural - body.offsetHeight;
   const rows = parseFloat(getComputedStyle(body).fontSize) * MIN_ROWS_EM;
   return { card, natural, min: Math.min(natural, chrome + rows) };
}

/**
 * Shares a column's height among its panels.
 *
 * @param {object[]} items - From measure, in column order.
 * @param {number} avail - Height to share.
 * @param {'priority'|'proportional'} mode - How leftover height goes out.
 */
function share(items, avail, mode)
{
   let spare = Math.max(0, avail - items.reduce((n, it) => n + it.min, 0));
   if (mode === 'priority')
   {
      for (const it of items)
      {
         const extra = Math.min(spare, it.natural - it.min);
         it.height = it.min + extra;
         spare -= extra;
      }
   }
   else
   {
      const want = items.reduce((n, it) => n + (it.natural - it.min), 0);
      const k = want <= spare ? 1 : spare / want;
      for (const it of items) { it.height = it.min + ((it.natural - it.min) * k); }
   }
   for (const it of items) { it.card.style.flexBasis = `${Math.floor(it.height)}px`; }
}

/**
 * Sizes the quest image and every panel for the current window. Safe to call often.
 *
 * @param {HTMLElement} root - The sheet window element.
 */
export function layoutPanels(root)
{
   const sheet = root?.querySelector('.fhql-sheet');
   const body = sheetBody(root);
   if (!sheet) { return; }
   // The quest image shrinks from 160px to 80px as the window gets shorter, before panels are squeezed.
   const banner = Math.round(Math.max(80, Math.min(160, (sheet.clientHeight - 480) * 0.5)));
   sheet.style.setProperty('--fhql-banner-h', `${banner}px`);
   if (!body) { return; }

   // Measuring briefly gives each panel its full height, which leaves nothing to scroll and resets its
   // scroll to the top. Keep every position across the measure-and-size pass.
   const keep = capturePanelScroll(root);
   body.style.minHeight = '';
   const cards = [...body.querySelectorAll('.fhql-col > .fhql-card')];
   if (isNarrow(root)) { for (const card of cards) { card.style.flexBasis = ''; } restorePanelScroll(root, keep); return; }

   const cols = [...body.querySelectorAll(':scope > .fhql-col')];
   const plan = cols.map((col, i) =>
   {
      const items = [...col.querySelectorAll(':scope > .fhql-card')].map(measure);
      const gap = parseFloat(getComputedStyle(col).rowGap) || 0;
      return { col, items, gap, mode: i === 0 ? 'proportional' : 'priority' };
   });
   const gaps = (p) => p.gap * Math.max(0, p.items.length - 1);
   const needed = Math.max(0, ...plan.map((p) => p.items.reduce((n, it) => n + it.min, 0) + gaps(p)));
   const room = plan[0]?.col.clientHeight ?? 0;
   // Last resort: the minimums don't fit, so the body grows and the sheet scrolls.
   if (needed + SLACK > room) { body.style.minHeight = `${body.offsetHeight + (needed + SLACK - room)}px`; }
   for (const p of plan) { share(p.items, p.col.clientHeight - gaps(p) - SLACK, p.mode); }
   restorePanelScroll(root, keep);
}

/**
 * Re-sizes when the window, or any panel's contents, change size (typing in an editor, an image
 * loading, a list growing). One observer per window, re-pointed after each render.
 *
 * @param {object} app - The quest sheet window.
 */
export function watchPanels(app)
{
   let queued = false;
   const run = () => { queued = false; layoutPanels(app.element); };
   app._panelObserver ??= new ResizeObserver(() =>
   {
      if (queued) { return; }
      queued = true;
      requestAnimationFrame(run);
   });
   const observer = app._panelObserver;
   observer.disconnect();
   if (!app.element) { return; }
   const sheet = app.element.querySelector('.fhql-sheet');
   if (sheet) { observer.observe(sheet); }
   for (const el of app.element.querySelectorAll('.fhql-panel-body > *')) { observer.observe(el); }
   // The header and GM notes take height from the panels when they grow: a font loading late, a long
   // title wrapping, GM notes opened. Without these the last panel was cut off until a resize.
   for (const el of app.element.querySelectorAll('.fhql-sheet-top, .fhql-gm-notes')) { observer.observe(el); }
   // Fonts that finish loading after the first layout change every height at once. Once per window.
   if (!app._panelFontsWatched)
   {
      app._panelFontsWatched = true;
      document.fonts?.ready?.then(() => layoutPanels(app.element));
   }
}

/* ---------- Narrow layout: collapsible panels ---------- */

/**
 * Marks panels the player collapsed (narrow layout only; CSS ignores the mark when wide).
 *
 * @param {object} app - The quest sheet window.
 */
export function applyCollapsed(app)
{
   for (const card of app.element?.querySelectorAll('.fhql-card[data-panel]') ?? [])
   {
      const collapsed = app._collapsedPanels.has(card.dataset.panel);
      card.classList.toggle('is-collapsed', collapsed);
      card.querySelector(':scope > .fhql-subheading')?.setAttribute('aria-expanded', String(!collapsed));
   }
}

/**
 * A click on a panel heading in the narrow layout collapses or expands it. Clicks on the heading's own
 * buttons and checkboxes are left alone.
 *
 * @param {object} app - The quest sheet window.
 * @param {Event} event - The click.
 * @returns {boolean} Whether it was handled.
 */
export function onPanelHeadingClick(app, event)
{
   const heading = event.target.closest?.('.fhql-card[data-panel] > .fhql-subheading');
   if (!heading || event.target.closest('button, input, label, a, select') || !isNarrow(app.element)) { return false; }
   const key = heading.parentElement.dataset.panel;
   if (app._collapsedPanels.has(key)) { app._collapsedPanels.delete(key); }
   else { app._collapsedPanels.add(key); }
   applyCollapsed(app);
   return true;
}
