import { MODULE_ID } from './constants.js';
import { focusQuestSearch, openQuestLog } from './api.js';

/** Registers keybindings. Called on `init`. Open is unbound by default; search defaults to /. Players can rebind both. */
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

   // "/" jumps to the Quest Log's search while the log is open; otherwise the key passes through.
   game.keybindings.register(MODULE_ID, 'focusSearch', {
      name: 'FHQL.Keybindings.FocusSearch',
      hint: 'FHQL.Keybindings.FocusSearchHint',
      editable: [{ key: 'Slash' }],
      onDown: () => focusQuestSearch()
   });
}
