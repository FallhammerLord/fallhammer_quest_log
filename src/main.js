import { MODULE_ID, QUEST_TYPE } from './constants.js';
import { DocumentSheetConfig } from './compat.js';
import { registerSettings } from './settings.js';
import { registerKeybindings } from './keybindings.js';
import { api } from './api.js';
import { QuestData } from './data/QuestData.js';
import { QuestPageSheet } from './sheets/QuestPageSheet.js';
import { QuestLog } from './apps/QuestLog.js';
import { QuestSheetApp } from './apps/QuestSheetApp.js';
import { questPage } from './data/quests.js';
import { registerEntryPoints } from './ui/entryPoints.js';
import { refreshInProgressWidget } from './ui/InProgressWidget.js';

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
   registerEntryPoints();
   game.modules.get(MODULE_ID).api = api;
});

Hooks.once('ready', () => refreshInProgressWidget());
Hooks.on('renderPlayers', () => refreshInProgressWidget());

/** Re-render our UI when any quest changes, on any client. */
const refresh = (options, userId) =>
{
   QuestLog.instance.onQuestChanged(options, userId);
   QuestSheetApp.refreshAll(options, userId);
   refreshInProgressWidget();
};

for (const action of ['create', 'update', 'delete'])
{
   Hooks.on(`${action}JournalEntryPage`, (page, ...rest) =>
   {
      if (page.type === QUEST_TYPE || page.getFlag(MODULE_ID, 'gmNotes')) { refresh(rest.at(-2), rest.at(-1)); }
   });
   Hooks.on(`${action}JournalEntry`, (entry, ...rest) =>
   {
      if (action === 'delete' || questPage(entry)) { refresh(rest.at(-2), rest.at(-1)); }
   });
}
