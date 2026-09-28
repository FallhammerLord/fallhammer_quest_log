import { MODULE_ID } from './constants.js';
import { registerSettings } from './settings.js';
import { registerKeybindings } from './keybindings.js';
import { api } from './api.js';

Hooks.once('init', () =>
{
   registerSettings();
   registerKeybindings();
   game.modules.get(MODULE_ID).api = api;
});
