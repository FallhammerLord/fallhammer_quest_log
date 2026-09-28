import { MODULE_ID, THEMES } from './constants.js';
import { refreshOpenApps } from './theme.js';

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
      onChange: refreshOpenApps
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
