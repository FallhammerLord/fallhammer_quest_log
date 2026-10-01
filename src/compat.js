/**
 * The compatibility boundary. Every version-sensitive Foundry API we touch is reached through this file,
 * so a new Foundry major means editing here first. See docs/SCOPE.md section 5.5.
 * Paths checked against the v14 community type definitions (build 14.366).
 */

import { MODULE_ID } from './constants.js';

/** ApplicationV2 base class, Handlebars mixin, and dialogs. */
export const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

/** Base class for every fhql window. */
export const HandlebarsApp = HandlebarsApplicationMixin(ApplicationV2);

/** Data model base and field classes. */
export const { TypeDataModel } = foundry.abstract;
export const fields = foundry.data.fields;

/** Journal page sheet base and sheet registration. */
export const { JournalEntryPageHandlebarsSheet } = foundry.applications.sheets.journal;
export const { DocumentSheetConfig, DocumentOwnershipConfig } = foundry.applications.apps;

/**
 * Fonts Foundry knows about, including ones uploaded through Core's Additional Fonts setting.
 *
 * @returns {Record<string, string>} Font family names mapped to labels.
 */
export function availableFonts()
{
   try { return foundry.applications.settings.menus.FontConfig.getAvailableFontChoices() ?? {}; }
   catch { return {}; }
}

/** @returns {typeof foundry.applications.ux.TextEditor} The configured TextEditor class. */
export function textEditor()
{
   const { TextEditor } = foundry.applications.ux;
   return TextEditor.implementation ?? TextEditor;
}

/**
 * Update value that deletes a key from an object field. v14 uses the `_del` operator;
 * older versions used the `-=key` syntax, which callers no longer need to know about.
 *
 * @param {string} path - Dot path of the parent object, e.g. `system.objectives`.
 * @param {string} key - Key to delete.
 * @returns {object} Update data.
 */
export function deleteKeyUpdate(path, key)
{
   return { [`${path}.${key}`]: globalThis._del };
}

/**
 * Where to put the Quest Log button in a sidebar directory. Prefers the header's action button row,
 * falling back to the header itself. Returns null if neither exists, so a Foundry UI change costs us
 * the button, never an error.
 *
 * @param {HTMLElement} element - The directory's root element.
 * @returns {{ parent: HTMLElement, prepend: boolean }|null} Insertion point.
 */
export function directoryButtonSlot(element)
{
   const actions = element?.querySelector('.directory-header .header-actions');
   if (actions) { return { parent: actions, prepend: false }; }
   const header = element?.querySelector('.directory-header');
   return header ? { parent: header, prepend: true } : null;
}

/** @returns {HTMLElement|null} The players list element, if rendered. */
export function playersElement()
{
   return ui.players?.element ?? document.getElementById('players');
}

/**
 * @param {HTMLElement} players - The players list element.
 * @returns {HTMLElement|null} One player row, used to match the widget's height.
 */
export function playerRowElement(players)
{
   return players?.querySelector('li.player, [data-user-id]') ?? null;
}

/**
 * The settings window's form fields for some of this module's settings, keyed by setting name.
 * Core names each field `<namespace>.<key>`.
 *
 * @param {HTMLElement} element - The settings window's root element.
 * @param {string[]} keys - Setting names.
 * @returns {Record<string, HTMLInputElement|HTMLSelectElement>} Fields present in the window.
 */
export function settingsFormFields(element, keys)
{
   const found = {};
   for (const key of keys)
   {
      const field = element?.querySelector(`[name="${MODULE_ID}.${key}"]`);
      if (field) { found[key] = field; }
   }
   return found;
}

/** Hook names for the core settings window opening and closing. */
export const SETTINGS_WINDOW_HOOKS = { render: 'renderSettingsConfig', close: 'closeSettingsConfig' };

/** Tidy 5e Sheets: its package ID and the world setting holding the GM's sheet colors. */
const TIDY_ID = 'tidy5e-sheet';
export const TIDY_THEME_SETTING = `${TIDY_ID}.worldThemeSettings`;

/**
 * The banner color Tidy 5e Sheets uses for this world, when Tidy is active: its header background
 * color if set, else its accent color. Tidy keeps its CSS variables inside its own sheets, so this
 * reads the stored setting instead (checked against Tidy's source, 2026-10). An internal setting:
 * any failure means "no match", never an error.
 *
 * @returns {string|null} A CSS color, or null.
 */
export function tidyBannerColor()
{
   if (!game.modules.get(TIDY_ID)?.active) { return null; }
   try
   {
      const settings = game.settings.get(TIDY_ID, 'worldThemeSettings');
      return settings?.headerBackgroundColor || settings?.accentColor || null;
   }
   catch { return null; }
}

/* ---------- GM relay transport (v13+ query API) ---------- */

/**
 * Registers a handler that other clients can call on this client with `User#query`.
 *
 * @param {string} name - Full query name, e.g. `fhql.deposit`.
 * @param {(data: object) => Promise<object>} handler - Runs on the receiving client.
 */
export function registerQuery(name, handler)
{
   CONFIG.queries[name] = handler;
}

/** @returns {User|null} The active GM who answers relayed requests, if one is connected. */
export function activeGM()
{
   return game.users.activeGM ?? null;
}

/**
 * Asks a user's client to run a registered query, and waits for its answer.
 *
 * @param {User} user - Who runs it (the active GM).
 * @param {string} name - Full query name.
 * @param {object} data - Request data.
 * @returns {Promise<object>} The handler's result. Rejects on timeout or error.
 */
export function queryUser(user, name, data)
{
   return user.query(name, data, { timeout: 15000 });
}

/**
 * Posts a chat message as the Quest Log.
 *
 * @param {string} alias - Speaker name.
 * @param {string} content - Message HTML (escape any user text first).
 * @returns {Promise<ChatMessage>} The message.
 */
export function postChat(alias, content)
{
   return ChatMessage.implementation.create({ speaker: { alias }, content });
}

/**
 * @param {Document|undefined} doc - Any document.
 * @returns {number} When it last changed (server time, ms), or 0 if unknown.
 */
export function modifiedTime(doc)
{
   return doc?._stats?.modifiedTime ?? 0;
}

/** Name of the scene control group our button joins. */
export const SCENE_CONTROL_GROUP = 'tokens';

/**
 * Reads a world setting belonging to another package, even when that package is inactive and its
 * setting isn't registered. Used to read FQL's primary quest during import.
 *
 * @param {string} key - Full setting key, e.g. `forien-quest-log.primaryQuest`.
 * @returns {unknown} The stored value, or undefined.
 */
export function readStoredWorldSetting(key)
{
   try
   {
      const stored = game.settings.storage.get('world')?.find((setting) => setting.key === key);
      if (!stored) { return undefined; }
      return typeof stored.value === 'string' ? JSON.parse(stored.value) : stored.value;
   }
   catch
   {
      return undefined;
   }
}
