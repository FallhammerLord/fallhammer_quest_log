import { JournalEntryPageHandlebarsSheet, textEditor } from '../compat.js';
import { MODULE_PATH, STATUSES } from '../constants.js';
import { questAccess } from '../data/quests.js';

/**
 * Sheet for `fhql.quest` pages inside Foundry's journal. A read-only summary with a button into the
 * Quest Log, where editing happens. Keeps the journal usable and gives every quest link a landing spot.
 */
export class QuestPageSheet extends JournalEntryPageHandlebarsSheet
{
   static DEFAULT_OPTIONS = {
      classes: ['fhql-page'],
      actions: {
         openInQuestLog: QuestPageSheet.#onOpenInQuestLog
      }
   };

   static VIEW_PARTS = {
      content: { template: `${MODULE_PATH}/templates/quest-page-view.hbs`, root: true }
   };

   static EDIT_PARTS = {
      header: super.EDIT_PARTS.header,
      content: { template: `${MODULE_PATH}/templates/quest-page-edit.hbs` },
      footer: super.EDIT_PARTS.footer
   };

   /** @override */
   async _prepareContentContext(context, options)
   {
      await super._prepareContentContext(context, options);

      const page = this.document;
      const entry = page.parent;
      const access = questAccess(entry);
      const { status, giver, description } = page.system;

      context.quest = {
         ...access,
         statusIcon: STATUSES[status]?.icon,
         statusLabel: game.i18n.localize(`FHQL.Status.${status}`),
         giverName: giver.name,
         descriptionHTML: access.full ? await textEditor().enrichHTML(description, {
            secrets: access.editable, relativeTo: page
         }) : ''
      };
   }

   /** @this {QuestPageSheet} */
   static #onOpenInQuestLog()
   {
      game.modules.get('fhql').api.openQuestLog(this.document.parent.id);
   }
}
