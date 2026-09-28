/**
 * The compatibility boundary. Every version-sensitive Foundry API we touch is reached through this file,
 * so a new Foundry major means editing here first. See docs/SCOPE.md section 5.5.
 * Paths checked against the v14 community type definitions (build 14.366).
 */

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

/** Name of the scene control group our button joins. */
export const SCENE_CONTROL_GROUP = 'tokens';
