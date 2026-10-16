/**
 * Window motion for the Quest Log and quest windows. See docs/SCOPE.md 7.4d.
 *
 * Opening: a short rise and fade, growing from about 96% (180ms). From the Beacon when it opened the
 * window, else from the window's own center. Closing: the reverse, settling toward the Beacon (log) or
 * the window's center (140ms). Players who ask their system for reduced motion get a plain fade.
 * Uses the browser's own animation (Element.animate), so it runs alongside Foundry's window code.
 */

const EASE_OPEN = 'cubic-bezier(.2,.7,.2,1)';
const EASE_CLOSE = 'cubic-bezier(.5,0,.75,0)';

/** Durations in ms. Short enough not to slow the table down; the fades are for reduced motion. */
const OPEN_MS = 180;
const CLOSE_MS = 140;
const FADE_IN_MS = 120;
const FADE_OUT_MS = 100;

/** @returns {boolean} Whether the player asked for reduced motion. */
const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * @param {HTMLElement} el - The window.
 * @param {HTMLElement|null} anchor - Where it grows from or settles to.
 * @returns {string} A transform-origin inside the window.
 */
function originFor(el, anchor)
{
   if (!anchor?.isConnected) { return '50% 50%'; }
   const a = anchor.getBoundingClientRect();
   const w = el.getBoundingClientRect();
   return `${Math.round(a.left + (a.width / 2) - w.left)}px ${Math.round(a.top - w.top)}px`;
}

/**
 * @param {HTMLElement} el - A window that just appeared.
 * @param {HTMLElement|null} [from] - The control that opened it (the Beacon).
 */
export function animateOpen(el, from = null)
{
   if (!el?.animate) { return; }
   if (reduced()) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_IN_MS }); return; }
   el.animate(
      [{ opacity: 0, transform: 'translateY(8px) scale(0.96)', transformOrigin: originFor(el, from) },
       { opacity: 1, transform: 'none', transformOrigin: originFor(el, from) }],
      { duration: OPEN_MS, easing: EASE_OPEN }
   );
}

/**
 * @param {HTMLElement} el - A window about to close.
 * @param {HTMLElement|null} [toward] - Where it settles (the Beacon), else its own center.
 * @returns {Promise<void>} Resolves when the motion ends.
 */
export async function animateClose(el, toward = null)
{
   if (!el?.animate) { return; }
   const animation = reduced()
    ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_OUT_MS, fill: 'forwards' })
    : el.animate(
       [{ opacity: 1, transform: 'none', transformOrigin: originFor(el, toward) },
        { opacity: 0, transform: 'translateY(6px) scale(0.96)', transformOrigin: originFor(el, toward) }],
       { duration: CLOSE_MS, easing: EASE_CLOSE, fill: 'forwards' }
    );
   try { await animation.finished; }
   catch { /* cancelled: close anyway */ }
}
