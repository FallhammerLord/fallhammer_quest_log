import { claimNotes, holdsNotes, notesEditor, releaseNotes } from '../../data/notesLock.js';
import { requestPlayerAction } from '../../data/playerActions.js';
import { questAccess, updateQuest } from '../../data/quests.js';
import { editorUnsaved } from './rows.js';

/**
 * Quest sheet: player notes, edited in place by one person at a time. See docs/SCOPE.md 5.12.
 *
 * The sheet keeps two flags: `_notesEditing` (this user is editing the shown quest's notes) and
 * `_openNotesEditor` (open the editor after the next render).
 */

/** @param {HTMLElement} root - The sheet element. @returns {HTMLElement|null} The notes editor, if shown. */
const notesEditorElement = (root) => root?.querySelector('prose-mirror[name="playerNotes"]') ?? null;

/**
 * Render data for player notes: who may edit them, and who is editing now.
 *
 * @param {object} app - The quest sheet.
 * @param {JournalEntry} entry - The quest.
 * @param {object} access - From questAccess.
 * @param {boolean} viaGM - The player edits through the GM.
 * @returns {object} Fields merged into the sheet context.
 */
export function notesContext(app, entry, access, viaGM)
{
   const canEditNotes = access.editable || viaGM;
   const notesEditing = canEditNotes && app._notesEditing && holdsNotes(entry);
   const holder = notesEditing ? null : notesEditor(entry);
   return {
      canEditNotes,
      notesEditing,
      notesLockedBy: holder ? game.i18n.format('FHQL.Notes.LockedBy', { name: holder.name }) : '',
      notesTakeOver: !!holder && access.gm,
      notesCanStart: canEditNotes && !holder
   };
}

/**
 * Before a re-render: an open notes editor (nothing typed yet) should reopen afterwards.
 *
 * @param {object} app - The quest sheet.
 */
export function rememberOpenNotes(app)
{
   if (app._notesEditing && notesEditorElement(app.element)?.open) { app._openNotesEditor = true; }
}

/**
 * After a render: opens the notes editor if asked to, as if the player clicked its own pen. The
 * `open` attribute at render breaks editing, so it isn't used.
 *
 * @param {object} app - The quest sheet.
 */
export function openNotesIfAsked(app)
{
   if (!app._openNotesEditor) { return; }
   app._openNotesEditor = false;
   const editor = notesEditorElement(app.element);
   if (editor && !editor.open) { requestAnimationFrame(() => editor.querySelector(':scope > button')?.click()); }
}

/**
 * Saves edited notes (directly, or through the GM for players), then releases the lock.
 *
 * @param {object} app - The quest sheet.
 * @param {JournalEntry} entry - The quest.
 * @param {string} html - The notes.
 */
export async function savePlayerNotes(app, entry, html)
{
   if (questAccess(entry).editable) { await updateQuest(entry, { 'system.playerNotes': html }); }
   else
   {
      const result = await requestPlayerAction({ action: 'playerNotes', entryId: entry.id, html });
      if (!result.ok) { throw new Error('Player notes refused'); }
   }
   app._notesEditing = false;
   await releaseNotes(entry);
   app.render();
}

/**
 * Stops editing notes without saving (closing the window, switching quests).
 *
 * @param {object} app - The quest sheet.
 * @param {JournalEntry} [entry] - The quest; omit to release whatever this user holds.
 */
export async function stopEditingNotes(app, entry)
{
   if (!app._notesEditing) { return; }
   app._notesEditing = false;
   await releaseNotes(entry);
}

/* ---------- Actions (called with `this` as the quest sheet) ---------- */

/**
 * Starts editing player notes in place. Claims them first, so only one person edits at a time; the
 * GM can take over from someone who walked away.
 */
async function onEditNotes(event, target)
{
   const entry = this.questEntry;
   if (!entry) { return; }
   const holder = await claimNotes(entry, { force: 'force' in target.dataset && game.user.isGM });
   if (holder)
   {
      ui.notifications.warn(game.i18n.format('FHQL.Notes.LockedBy', { name: holder.name }));
      this.render();
      return;
   }
   this._notesEditing = true;
   this._openNotesEditor = true;
   this.render();
}

/** Finishes editing player notes: saves unsaved text (which releases them), or just releases. */
async function onFinishNotes()
{
   const entry = this.questEntry;
   const editor = notesEditorElement(this.element);
   if (editor && editorUnsaved(editor)) { editor.save(); return; }
   this._notesEditing = false;
   if (entry) { await releaseNotes(entry); }
   this.render();
}

/** Player notes actions, merged into the quest sheet's actions. */
export const notesActions = {
   editNotes: onEditNotes,
   finishNotes: onFinishNotes
};
