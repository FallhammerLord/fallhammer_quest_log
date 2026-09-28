import { MODULE_ID, QUEST_TYPE } from './constants.js';
import { DocumentSheetConfig } from './compat.js';
import { registerSettings } from './settings.js';
import { registerKeybindings } from './keybindings.js';
import { api } from './api.js';
import { QuestData } from './data/QuestData.js';
import { QuestPageSheet } from './sheets/QuestPageSheet.js';
import { QuestLog } from './apps/QuestLog.js';
import { questPage } from './data/quests.js';

Hooks.once('init', () =>
{
   CONFIG.JournalEntryPage.dataModels[QUEST_TYPE] = QuestData;
   DocumentSheetConfig.registerSheet(JournalEntryPage, MODULE_ID, QuestPageSheet, {
      types: [QUEST_TYPE],
      makeDefault: true,
      label: 'FHQL.Page.SheetLabel'
   });

   registerSettings();
   registerKeybindings();
   game.modules.get(MODULE_ID).api = api;
});

/** Re-render the Quest Log when any quest changes, on any client. */
const refresh = (options, userId) => QuestLog.instance.onQuestChanged(options, userId);

for (const action of ['create', 'update', 'delete'])
{
   Hooks.on(`${action}JournalEntryPage`, (page, ...rest) =>
   {
      if (page.type === QUEST_TYPE) { refresh(rest.at(-2), rest.at(-1)); }
   });
   Hooks.on(`${action}JournalEntry`, (entry, ...rest) =>
   {
      if (action === 'delete' || questPage(entry)) { refresh(rest.at(-2), rest.at(-1)); }
   });
}
