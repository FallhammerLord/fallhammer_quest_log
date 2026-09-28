import { MODULE_ID } from './constants.js';
import { openQuestLog } from './api.js';

/** Registers keybindings. Called on `init`. Unbound by default; players pick their own key. */
export function registerKeybindings()
{
   game.keybindings.register(MODULE_ID, 'openQuestLog', {
      name: 'FHQL.Keybindings.OpenQuestLog',
      editable: [],
      onDown: () =>
      {
         openQuestLog();
         return true;
      }
   });
}
