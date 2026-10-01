/**
 * Keeps a window from being resized below a readable size. Applied through each window's
 * `_updatePosition`, the ApplicationV2 hook for resolving requested positions.
 *
 * @param {object} position - Requested position.
 * @param {{ width: number, height: number }} min - Minimum size in pixels.
 * @returns {object} The position with width and height clamped.
 */
export function clampToMinSize(position, min)
{
   if (typeof position.width === 'number') { position.width = Math.max(position.width, min.width); }
   if (typeof position.height === 'number') { position.height = Math.max(position.height, min.height); }
   return position;
}

/** How close (px) a dragged width must come to a comfort width before it settles there. */
const SNAP_RANGE = 20;

/** Shift held: resize freely, no snapping. */
let freeResize = false;
globalThis.addEventListener?.('keydown', (event) => { if (event.key === 'Shift') { freeResize = true; } });
globalThis.addEventListener?.('keyup', (event) => { if (event.key === 'Shift') { freeResize = false; } });
globalThis.addEventListener?.('blur', () => { freeResize = false; });

/**
 * Comfort snaps: a width dragged within SNAP_RANGE of one of the window's intended widths settles on
 * it, so resizing lands on layouts that fit well instead of a few pixels past a reflow. Any other
 * width is left alone; holding Shift turns snapping off.
 *
 * @param {object} position - Requested position.
 * @param {number[]} widths - Intended widths in pixels.
 * @returns {object} The position, its width snapped if it was close.
 */
export function snapWidth(position, widths)
{
   if (freeResize || typeof position.width !== 'number') { return position; }
   const near = widths.find((w) => Math.abs(position.width - w) <= SNAP_RANGE);
   if (near !== undefined) { position.width = near; }
   return position;
}
