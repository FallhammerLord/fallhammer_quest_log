/**
 * Where each game system keeps the things the Quest Log needs from items. Systems store an item's
 * stack size in different places; deposits read and reduce it there.
 *
 * Paths checked against each system's own source (2026-10-01):
 * - D&D 5e (`dnd5e`): physical item template, `system.quantity`.
 * - Pathfinder 2e (`pf2e`): physical items, `system.quantity`.
 * - Daggerheart (`daggerheart`): inventory items, `system.quantity`.
 * - Cypher System (`cyphersystem`): equipment, ammo, material, `system.basic.quantity`.
 *
 * Any other system falls back to probing those paths (and `{ value }` objects at them). An item with
 * none counts as one.
 */

const SYSTEMS = {
   dnd5e: { name: 'D&D 5e', quantity: 'system.quantity' },
   pf2e: { name: 'Pathfinder 2e', quantity: 'system.quantity' },
   daggerheart: { name: 'Daggerheart', quantity: 'system.quantity' },
   cyphersystem: { name: 'Cypher System', quantity: 'system.basic.quantity' }
};

const FALLBACK_PATHS = ['system.quantity', 'system.basic.quantity'];

/** @returns {{ id: string, name: string, quantity: string }|null} The current system's entry, if known. */
function currentSystem()
{
   const id = globalThis.game?.system?.id;
   return SYSTEMS[id] ? { id, ...SYSTEMS[id] } : null;
}

/**
 * @param {Item|object} item - An item, or item data.
 * @returns {{ path: string, value: number }|null} Where its stack size is, or null if untracked.
 */
function quantityField(item)
{
   const known = currentSystem()?.quantity;
   for (const path of known ? [known, ...FALLBACK_PATHS.filter((p) => p !== known)] : FALLBACK_PATHS)
   {
      const raw = foundry.utils.getProperty(item, path);
      if (Number.isFinite(raw)) { return { path, value: raw }; }
      if (Number.isFinite(raw?.value)) { return { path: `${path}.value`, value: raw.value }; }
   }
   return null;
}

/**
 * @param {Item|object} item - An item, or item data.
 * @returns {number|null} Its stack size, or null when the system doesn't track one for it.
 */
export function itemQuantity(item)
{
   return quantityField(item)?.value ?? null;
}

/**
 * @param {Item|object} item - An item, or item data.
 * @param {number} quantity - New stack size.
 * @returns {object} Update data setting it, at the system's own path.
 */
export function itemQuantityUpdate(item, quantity)
{
   return { [quantityField(item)?.path ?? currentSystem()?.quantity ?? FALLBACK_PATHS[0]]: quantity };
}

/**
 * Documents an item was copied from: its compendium source, the world item it was duplicated from,
 * and the legacy core source flag. Used to match deposits to a required item.
 *
 * @param {Item} item - An item.
 * @returns {string[]} UUIDs, possibly empty.
 */
export function itemSourceUuids(item)
{
   return [item?._stats?.compendiumSource, item?._stats?.duplicateSource, item?.flags?.core?.sourceId].filter(Boolean);
}

/** @returns {string} A line for the console and the API: which system, and where quantity is read. */
export function systemSupportSummary()
{
   const sys = currentSystem();
   const id = globalThis.game?.system?.id ?? 'unknown';
   return sys
    ? `${sys.name} (${id}): item quantity at ${sys.quantity}`
    : `${id}: not specifically supported; item quantity probed at ${FALLBACK_PATHS.join(', ')}`;
}
