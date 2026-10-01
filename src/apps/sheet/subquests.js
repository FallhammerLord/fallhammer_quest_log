import { MODULE_ID } from '../../constants.js';
import { createSubquest, deleteQuest, getQuestEntry, setParent } from '../../data/quests.js';
import { confirmPopover } from '../../ui/popover.js';

/**
 * Quest sheet: subquests. Adding or opening a subquest shows it in its own window beside this one
 * (drill-down), with one side slot per window: opening a second subquest replaces the first in the
 * same place. The GM can unlink a subquest, keeping it as its own quest or deleting it.
 */

/** @param {string} id - Quest ID. @param {object} source - The window it opens beside. @param {boolean} [edit] - Open editing. */
const openBeside = (id, source, edit = false) => game.modules.get(MODULE_ID).api.openQuestSheet(id, { edit, beside: source });

/** Add a subquest (GM): creates it Hidden and opens it beside this window, ready to edit. */
async function onAddSubquest()
{
   const entry = this.questEntry;
   if (!entry) { return; }
   const child = await createSubquest(entry);
   openBeside(child.id, this, true);
}

/** A subquest row: opens that quest beside this window, in this window's side slot. */
function onOpenSubquest(event, target)
{
   if (target.dataset.questId) { openBeside(target.dataset.questId, this); }
}

/** Unlink a subquest (GM): make it standalone, or delete it. */
async function onRemoveSubquest(event, target)
{
   const child = getQuestEntry(target.dataset.questId);
   if (!child) { return; }
   const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
   const choice = await confirmPopover(this, target, {
      message: `<p>${t('FHQL.Subquest.RemoveConfirm', { name: foundry.utils.escapeHTML(child.name) })}</p>`,
      no: t('FHQL.Subquest.MakeStandalone'),
      yes: t('FHQL.Subquest.DeleteQuest'),
      danger: true
   });
   if (choice === false) { await setParent(child, ''); }
   else if (choice === true) { await deleteQuest(child); }
}

/** Subquest actions, merged into the quest sheet's actions. */
export const subquestActions = {
   addSubquest: onAddSubquest,
   openSubquest: onOpenSubquest,
   removeSubquest: onRemoveSubquest
};
