import { MODULE_ID, THEMES } from './constants.js';
import { refreshOpenApps } from './theme.js';
import { refreshQuestBeacon } from './ui/QuestBeacon.js';

/** Registers module settings. Called on `init`. */
export function registerSettings()
{
   game.settings.register(MODULE_ID, 'theme', {
      name: 'FHQL.Settings.Theme.Name',
      hint: 'FHQL.Settings.Theme.Hint',
      scope: 'client',
      config: true,
      type: String,
      choices: {
         [THEMES.auto]: 'FHQL.Settings.Theme.Auto',
         [THEMES.light]: 'FHQL.Settings.Theme.Light',
         [THEMES.dark]: 'FHQL.Settings.Theme.Dark',
         [THEMES.scifi]: 'FHQL.Settings.Theme.Scifi'
      },
      default: THEMES.auto,
      onChange: () =>
      {
         refreshOpenApps();
         refreshQuestBeacon();
      }
   });

   game.settings.register(MODULE_ID, 'showInProgress', {
      name: 'FHQL.Settings.ShowInProgress.Name',
      hint: 'FHQL.Settings.ShowInProgress.Hint',
      scope: 'client',
      config: true,
      type: Boolean,
      default: true,
      onChange: () => refreshQuestBeacon()
   });

   game.settings.register(MODULE_ID, 'showNextObjective', {
      name: 'FHQL.Settings.ShowNextObjective.Name',
      hint: 'FHQL.Settings.ShowNextObjective.Hint',
      scope: 'client',
      config: true,
      type: Boolean,
      default: true,
      onChange: () => refreshQuestBeacon()
   });

   game.settings.register(MODULE_ID, 'listFilter', {
      scope: 'client',
      config: false,
      type: Object,
      default: { statuses: [], collapsed: [] }
   });

   game.settings.register(MODULE_ID, 'gmNotesOpen', {
      scope: 'client',
      config: false,
      type: Boolean,
      default: false
   });

   const { LIMITED, OBSERVER } = CONST.DOCUMENT_OWNERSHIP_LEVELS;
   game.settings.register(MODULE_ID, 'defaultOwnership', {
      name: 'FHQL.Settings.DefaultOwnership.Name',
      hint: 'FHQL.Settings.DefaultOwnership.Hint',
      scope: 'world',
      config: true,
      type: Number,
      choices: {
         [LIMITED]: 'FHQL.Settings.DefaultOwnership.Limited',
         [OBSERVER]: 'FHQL.Settings.DefaultOwnership.Observer'
      },
      default: OBSERVER
   });
}
