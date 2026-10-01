import { DocumentOwnershipConfig } from '../../compat.js';
import { MODULE_ID } from '../../constants.js';
import { confirmPopover, menuPopover } from '../../ui/popover.js';
import {
   deleteQuest, moveQuestToFolder, parentCandidates, questPage, questRootFolder, questSubfolders, setParent
} from '../../data/quests.js';

/**
 * Quest sheet: the GM's quest menu (⋮ button, and right-click on Quest Log rows). Pop out, access,
 * move to folder, set parent, delete.
 */

/**
 * @param {object} app - The quest sheet or Quest Log.
 * @param {JournalEntry} entry - The quest the menu acts on.
 * @returns {object[]} Menu items. GM only.
 */
function questMenuItems(app, entry)
{
   const t = (key) => game.i18n.localize(key);
   return [
      ...(app.options.questId === entry.id ? [] : [{ value: 'popOut', label: t('FHQL.Menu.PopOut'), icon: 'fa-solid fa-up-right-from-square' }]),
      { value: 'access', label: t('FHQL.Menu.Access'), icon: 'fa-solid fa-user-lock' },
      { value: 'move', label: t('FHQL.Menu.Move'), icon: 'fa-solid fa-folder-open' },
      { value: 'parent', label: t('FHQL.Menu.Parent'), icon: 'fa-solid fa-diagram-project' },
      { value: 'delete', label: t('FHQL.Menu.Delete'), icon: 'fa-solid fa-trash', danger: true }
   ];
}

/**
 * Opens the quest menu for a quest and runs the chosen action.
 *
 * @param {object} app - The window it opens in.
 * @param {JournalEntry} entry - The quest.
 * @param {HTMLElement|{ x: number, y: number }} anchor - Where to open the menu.
 */
export async function openQuestMenu(app, entry, anchor)
{
   if (!entry || !game.user.isGM) { return; }
   const choice = await menuPopover(app, anchor, { items: questMenuItems(app, entry) });
   const control = anchor instanceof HTMLElement ? anchor : null;
   switch (choice)
   {
      case 'popOut': return game.modules.get(MODULE_ID).api.openQuestSheet(entry.id);
      case 'access': return new DocumentOwnershipConfig({ document: entry }).render({ force: true });
      case 'move': return chooseFolder(app, entry, control ?? anchor);
      case 'parent': return chooseParent(app, entry, control ?? anchor);
      case 'delete': return confirmDelete(app, entry, control ?? anchor);
   }
}

/** Picks a folder in the quest tree and moves the quest there. */
async function chooseFolder(app, entry, anchor)
{
   const root = questRootFolder();
   const current = entry.folder?.id === root?.id ? '' : entry.folder?.id ?? '';
   const path = (folder) => [...folder.ancestors.filter((a) => a.id !== root?.id).reverse(), folder].map((f) => f.name).join(' / ');
   const items = [
      { value: '', label: game.i18n.localize('FHQL.Folders.TopLevel'), current: current === '' },
      ...questSubfolders().map((f) => ({ value: f.id, label: path(f), current: f.id === current }))
       .sort((a, b) => a.label.localeCompare(b.label))
   ];
   const choice = await menuPopover(app, anchor, { title: game.i18n.localize('FHQL.Folders.MoveTo'), items });
   if (choice !== null) { await moveQuestToFolder(entry, choice); }
}

/** Picks a parent quest (or none). Quests below this one are left out to prevent loops. */
async function chooseParent(app, entry, anchor)
{
   const current = questPage(entry).system.parentQuest;
   const items = [
      { value: '', label: game.i18n.localize('FHQL.Quest.NoParent'), current: !current },
      ...parentCandidates(entry).map((e) => ({ value: e.id, label: e.name, current: e.id === current }))
   ];
   const choice = await menuPopover(app, anchor, { title: game.i18n.localize('FHQL.Quest.SetParent'), items });
   if (choice !== null) { await setParent(entry, choice); }
}

/** Confirms, then deletes the quest. */
async function confirmDelete(app, entry, anchor)
{
   const ok = await confirmPopover(app, anchor, {
      message: `<p>${game.i18n.format('FHQL.Quest.DeleteConfirm', { name: foundry.utils.escapeHTML(entry.name) })}</p>`,
      yes: game.i18n.localize('FHQL.Menu.Delete'),
      danger: true
   });
   if (!ok) { return; }
   if (entry.id === app.questId) { app._editing = false; }
   await deleteQuest(entry);
}

/** The ⋮ button's action, merged into the quest sheet's actions. */
export const questMenuActions = {
   questMenu(event, target) { return openQuestMenu(this, this.questEntry, target); }
};
