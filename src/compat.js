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
   catch { return {}; } // No font list in this Foundry version: the themes' own fonts still apply.
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

/**
 * Removes folders and entries from a rendered sidebar directory (folder contents go with their folder).
 *
 * @param {HTMLElement} element - The directory's root element.
 * @param {(id: string) => boolean} dropFolder - Whether to remove a folder, by ID.
 * @param {(id: string) => boolean} dropEntry - Whether to remove an entry, by ID.
 */
export function pruneDirectory(element, dropFolder, dropEntry)
{
   for (const row of element?.querySelectorAll('[data-folder-id]') ?? [])
   {
      if (dropFolder(row.dataset.folderId)) { row.remove(); }
   }
   for (const row of element?.querySelectorAll('[data-entry-id]') ?? [])
   {
      if (dropEntry(row.dataset.entryId)) { row.remove(); }
   }
}

/**
 * @param {string} namespace - The setting's module ID.
 * @param {string} key - The setting's key.
 * @returns {object|undefined} Its registered options (name, hint, type, choices).
 */
export function settingConfig(namespace, key)
{
   return game.settings.settings.get(`${namespace}.${key}`);
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
   catch { return null; } // Tidy renamed or dropped this setting: Ledger falls back to its own banner color.
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
 * @param {{ whisper?: string[] }} [options] - User IDs to whisper to; empty for everyone.
 * @returns {Promise<ChatMessage>} The message.
 */
export function postChat(alias, content, { whisper = [] } = {})
{
   return ChatMessage.implementation.create({ speaker: { alias }, content, whisper });
}

/**
 * @param {Document|undefined} doc - Any document.
 * @returns {number} When it last changed (server time, ms), or 0 if unknown.
 */
export function modifiedTime(doc)
{
   return doc?._stats?.modifiedTime ?? 0;
}

/**
 * Shows Foundry's tooltip with our own HTML next to an element.
 *
 * @param {HTMLElement} element - What it points at.
 * @param {string} html - Tooltip HTML (Foundry cleans it).
 * @param {string} cssClass - Class on the tooltip, for our styles.
 */
export function showTooltip(element, html, cssClass)
{
   game.tooltip?.activate(element, { html, cssClass });
}

/** Hides Foundry's tooltip. */
export function hideTooltip()
{
   game.tooltip?.deactivate();
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

/**
 * Opens Foundry's file browser for an image (v13+ FilePicker). Closing it without a choice does nothing.
 *
 * @param {string} current - The path to start from.
 * @param {(path: string) => void} onPick - Called with the chosen path.
 */
export function browseImage(current, onPick)
{
   const Picker = foundry.applications.apps.FilePicker.implementation;
   new Picker({ type: 'image', current: current || '', callback: onPick }).render(true);
}

/**
 * @param {HTMLElement} element - A window's root element.
 * @returns {HTMLElement|null} Its title bar (ApplicationV2's header).
 */
export function windowHeader(element)
{
   return element?.querySelector(':scope > .window-header') ?? null;
}

/**
 * Adds a font to Foundry's font list (CONFIG.fontDefinitions), so Foundry loads it and lists it in
 * font pickers, including ours. Leaves a font Foundry already knows alone.
 *
 * @param {string} family - Font family name.
 * @param {string} url - Font file path, relative to Foundry's root.
 * @returns {boolean} Whether it was added.
 */
export function registerFont(family, url)
{
   CONFIG.fontDefinitions ??= {};
   if (CONFIG.fontDefinitions[family]) { return false; }
   CONFIG.fontDefinitions[family] = { editor: true, fonts: [{ urls: [url] }] };
   return true;
}

/**
 * Shows a notification whose text may hold names players chose (items, actors, users, quests). Angle
 * brackets become look-alike marks, so a name can never be read as markup, whether or not Foundry
 * escapes notifications itself (and nothing is escaped twice).
 *
 * @param {'info'|'warn'|'error'} level - Notification type.
 * @param {string} message - Plain text.
 */
export function notify(level, message)
{
   ui.notifications[level]?.(String(message ?? '').replace(/</g, '‹').replace(/>/g, '›'));
}

/**
 * Loads templates and registers each as a Handlebars partial under its own path.
 *
 * @param {string[]} paths - Template paths, relative to Foundry's root.
 * @returns {Promise<void>} Resolves once all are loaded.
 */
export async function preloadTemplates(paths)
{
   await foundry.applications.handlebars.loadTemplates(paths);
}

/**
 * Renders a template loaded by preloadTemplates without waiting, for UI that redraws in step with a
 * change (the Beacon). Foundry's renderTemplate is async, and overlapping redraws could land out of order.
 *
 * @param {string} path - A template path given to preloadTemplates.
 * @param {object} data - The template's data.
 * @returns {string|null} HTML, or null while the template is still loading.
 */
export function renderLoadedTemplate(path, data)
{
   let template = Handlebars.partials[path];
   if (!template) { return null; }
   if (typeof template === 'string') { template = Handlebars.compile(template); }
   return template(data, { allowProtoPropertiesByDefault: true, allowProtoMethodsByDefault: true });
}

/**
 * Like renderLoadedTemplate, for UI that can't wait or do without (child panels, chat cards). Throws
 * if the template hasn't loaded, which only happens in the first moments after a launch.
 *
 * @param {string} path - A template path given to preloadTemplates.
 * @param {object} data - The template's data.
 * @returns {string} HTML.
 */
export function renderTemplateNow(path, data)
{
   const html = renderLoadedTemplate(path, data);
   if (html === null) { throw new Error(`${path} has not loaded yet`); }
   return html;
}

/** @returns {number} How deep Foundry lets folders nest, counting the top-level folder as 1. */
export function folderMaxDepth()
{
   return CONST.FOLDER_MAX_DEPTH ?? 4;
}

/**
 * An asset path as a full address from the site root (with Foundry's route prefix, if any). Paths
 * set on an element through a CSS variable resolve against the stylesheet that uses them, not the
 * page, so a relative path ("worlds/…") would point inside the module's styles folder.
 *
 * @param {string} path - A path relative to Foundry's root, or a full URL.
 * @returns {string} The address to use in CSS.
 */
export function assetUrl(path)
{
   if (/^([a-z][a-z0-9+.-]*:|\/)/i.test(path)) { return path; }
   return foundry.utils.getRoute(path);
}
