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
