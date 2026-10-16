/** The Quest Log's folder menu (GM, right-click a folder): new subfolder, rename, move, delete. */
import { canHoldSubfolder, createQuestFolder, deleteQuestFolder, folderMoveTargets, moveQuestFolder, questRootFolder } from '../data/quests.js';
import { confirmPopover, inputPopover, menuPopover } from '../ui/popover.js';

/**
 * The GM's folder menu: new subfolder, rename, move into another folder, delete (its quests and
 * folders move up a level).
 *
 * @param {object} app - The Quest Log.
 * @param {Folder} folder - The folder right-clicked.
 * @param {HTMLElement|{ x: number, y: number }} anchor - Where the menu opens.
 */
export async function openFolderMenu(app, folder, anchor)
{
   const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
   const targets = folderMoveTargets(folder);
   const choice = await menuPopover(app, anchor, {
      title: folder.name,
      items: [
         canHoldSubfolder(folder) ? { value: 'sub', label: t('FHQL.Folders.NewSub'), icon: 'fa-solid fa-folder-plus' } : null,
         { value: 'rename', label: t('FHQL.Folders.Rename'), icon: 'fa-solid fa-i-cursor' },
         targets.length ? { value: 'move', label: t('FHQL.Folders.Move'), icon: 'fa-solid fa-folder-tree' } : null,
         { value: 'delete', label: t('FHQL.Folders.Delete'), icon: 'fa-solid fa-trash', danger: true }
      ].filter(Boolean)
   });
   if (choice === 'sub')
   {
      const name = await inputPopover(app, anchor, { label: t('FHQL.Folders.Name'), value: t('FHQL.Folders.NewName'), ok: t('FHQL.Folders.Create') });
      if (name) { await createQuestFolder(name, folder.id); }
   }
   else if (choice === 'rename')
   {
      const name = await inputPopover(app, anchor, { label: t('FHQL.Folders.Name'), value: folder.name, ok: t('FHQL.Folders.Rename') });
      if (name?.trim()) { await folder.update({ name: name.trim() }); }
   }
   else if (choice === 'move')
   {
      const root = questRootFolder();
      const target = await menuPopover(app, anchor, {
         title: t('FHQL.Folders.Move'),
         items: targets.map((f) => ({
            value: f.id,
            label: f.id === root.id ? t('FHQL.Folders.TopLevel') : f.name,
            hint: f.id === root.id ? '' : f.ancestors.filter((a) => a.id !== root.id).map((a) => a.name).reverse().join(' › '),
            icon: f.id === root.id ? 'fa-solid fa-layer-group' : 'fa-solid fa-folder'
         }))
      });
      if (target) { await moveQuestFolder(folder, target); }
   }
   else if (choice === 'delete')
   {
      const parent = folder.folder?.id === questRootFolder()?.id ? t('FHQL.Folders.TopLevel') : folder.folder?.name;
      const sure = await confirmPopover(app, anchor, {
         message: foundry.utils.escapeHTML(t('FHQL.Folders.DeleteConfirm', { name: folder.name, parent })),
         yes: t('FHQL.Folders.Delete'),
         danger: true
      });
      if (sure) { await deleteQuestFolder(folder); }
   }
}
