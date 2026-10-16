import { MODULE_ID, QUEST_TYPE } from './constants.js';
import { DocumentSheetConfig, TIDY_THEME_SETTING } from './compat.js';
import { ensureThemeStyles, loadBundledFonts, refreshOpenApps } from './theme.js';
import { migrateTextureSetting, registerSettings } from './settings.js';
import { runMigrations } from './data/migrations.js';
import { registerKeybindings } from './keybindings.js';
import { api } from './api.js';
import { QuestData } from './data/QuestData.js';
import { QuestPageSheet } from './sheets/QuestPageSheet.js';
import { QuestLog } from './apps/QuestLog.js';
import { QuestSheetApp } from './apps/QuestSheetApp.js';
import { questPage, renameLegacyRootFolder } from './data/quests.js';
import { registerEntryPoints } from './ui/entryPoints.js';
import { refreshQuestBeacon } from './ui/QuestBeacon.js';
import { registerSettingsPreview } from './ui/settingsPreview.js';
import { registerShareQuery } from './ui/share.js';
import { registerEggs } from './ui/eggs.js';
import { registerQuestPreview } from './ui/questPreview.js';
import { registerRewardDrop, registerRewardQueries } from './data/rewards.js';
import { registerLifecycleHooks } from './data/lifecycle.js';
import { registerPlayerActionQueries } from './data/playerActions.js';
import { registerDepositQueries } from './data/deposits.js';
import { releaseNotes, touchesNotesLock } from './data/notesLock.js';
import { systemSupportSummary } from './data/systemItems.js';
import { onlySeenChanged, startSeenTracking } from './data/seen.js';

Hooks.once('init', () =>
{
   loadBundledFonts();
   CONFIG.JournalEntryPage.dataModels[QUEST_TYPE] = QuestData;
   DocumentSheetConfig.registerSheet(JournalEntryPage, MODULE_ID, QuestPageSheet, {
      types: [QUEST_TYPE],
      makeDefault: true,
      label: 'FHQL.Page.SheetLabel'
   });

   registerSettings();
   registerKeybindings();
   registerEntryPoints();
   registerRewardQueries();
   registerRewardDrop();
   registerLifecycleHooks();
   registerPlayerActionQueries();
   registerDepositQueries();
   registerSettingsPreview();
   registerShareQuery();
   registerEggs();
   game.modules.get(MODULE_ID).api = api;
});

/** A user leaving drops their notes lock in effect (only connected users count); show it. */
Hooks.on('userConnected', () =>
{
   QuestLog.instance.onQuestChanged({}, null);
   QuestSheetApp.refreshAll({}, null);
});

Hooks.once('ready', () =>
{
   console.log(`${MODULE_ID} | ${systemSupportSummary()}`);
   ensureThemeStyles();
   // A notes lock left from a previous session (closed browser) is cleared.
   releaseNotes();
   startSeenTracking();
   registerQuestPreview();
   refreshQuestBeacon();
   renameLegacyRootFolder();
   migrateTextureSetting();
   runMigrations();
});
Hooks.on('renderPlayers', () => refreshQuestBeacon());

/** The Ledger theme follows Tidy 5e Sheets' colors; restyle when the GM changes them. */
Hooks.on('updateSetting', (setting) =>
{
   if (setting.key !== TIDY_THEME_SETTING) { return; }
   refreshOpenApps();
   refreshQuestBeacon();
});

/**
 * Personal tracking lives on the user's own document; refresh when it changes. Anyone's player-notes
 * lock also refreshes, so others see "Rinn is editing" come and go.
 */
Hooks.on('updateUser', (user, changes) =>
{
   const mine = user.id === game.user.id && foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`);
   if (!mine && !touchesNotesLock(changes)) { return; }
   // Seeing a quest only changes its dot: redraw the list and Beacon, never an open sheet.
   if (mine && onlySeenChanged(changes))
   {
      refreshQuestBeacon();
      if (QuestLog.instance.rendered) { QuestLog.instance.render({ parts: ['list'] }); }
      return;
   }
   refreshQuestBeacon();
   QuestLog.instance.onQuestChanged({}, null);
   QuestSheetApp.refreshAll({}, null);
});

/**
 * Re-render our UI when any quest changes, on any client. Batched to one redraw per animation frame:
 * one change fires several hooks (page and entry), and fast clicks stacked overlapping redraws. Quest
 * windows redraw only when they show a changed quest, its parent, or one of its subquests.
 */
let batch = null;

/**
 * @param {object} options - The document operation options.
 * @param {string} userId - Who made the change.
 * @param {string|null} entryId - The changed quest's JournalEntry ID, or null if unknown.
 * @param {string} [parentId] - Its parent quest, read when the change happened (a deleted quest can't
 *   be looked up later).
 */
const refresh = (options, userId, entryId = null, parentId = '') =>
{
   if (!batch)
   {
      batch = { quiet: true, ids: new Set(), unknown: false };
      requestAnimationFrame(flushRefresh);
   }
   // Quiet (a field this client typed into) only if every change in the batch was.
   batch.quiet &&= userId === game.user.id && !!options?.fhqlQuiet;
   if (entryId) { batch.ids.add(entryId); }
   else { batch.unknown = true; }
   if (parentId) { batch.ids.add(parentId); }
};

function flushRefresh()
{
   const { quiet, ids, unknown } = batch;
   batch = null;
   const options = quiet ? { fhqlQuiet: true } : {};
   const userId = quiet ? game.user.id : null;
   const changed = unknown ? null : ids;
   QuestLog.instance.onQuestChanged(options, userId, changed);
   QuestSheetApp.refreshAll(options, userId, changed);
   refreshQuestBeacon();
}

for (const action of ['create', 'update', 'delete'])
{
   Hooks.on(`${action}Folder`, (folder, ...rest) =>
   {
      if (folder.type === 'JournalEntry') { QuestLog.instance.onQuestChanged(rest.at(-2), rest.at(-1)); }
   });
   Hooks.on(`${action}JournalEntryPage`, (page, ...rest) =>
   {
      if (page.type !== QUEST_TYPE && !page.getFlag(MODULE_ID, 'gmNotes')) { return; }
      // A new parent also changes the old parent's subquest list, which can't be known here: redraw all.
      const reparented = action === 'update' && foundry.utils.hasProperty(rest[0], 'system.parentQuest');
      const entry = page.parent;
      refresh(rest.at(-2), rest.at(-1), reparented ? null : entry?.id ?? null, questPage(entry)?.system.parentQuest);
   });
   Hooks.on(`${action}JournalEntry`, (entry, ...rest) =>
   {
      if (action === 'delete' || questPage(entry)) { refresh(rest.at(-2), rest.at(-1), entry.id, questPage(entry)?.system.parentQuest); }
   });
}
