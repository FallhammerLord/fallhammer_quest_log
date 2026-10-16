import { MODULE_ID } from './constants.js';

/**
 * Reading and writing this module's settings: the one way to do it, so every call names only the key.
 * Imports nothing but constants, so any file can use it without import loops. (Theme code also reads
 * unsaved choices from the settings window; see `shownSetting` in src/theme.js.)
 */

/**
 * @param {string} key - A setting registered in src/settings.js.
 * @returns {*} Its value.
 */
export function getSetting(key)
{
   return game.settings.get(MODULE_ID, key);
}

/**
 * @param {string} key - A setting registered in src/settings.js.
 * @param {*} value - The new value.
 * @returns {Promise<*>} Resolves when saved.
 */
export function setSetting(key, value)
{
   return game.settings.set(MODULE_ID, key, value);
}
