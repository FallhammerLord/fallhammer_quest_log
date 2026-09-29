import { SCENE_CONTROL_GROUP, directoryButtonSlot } from '../compat.js';
import { openQuestLog } from '../api.js';
import { MODULE_ID } from '../constants.js';
import { questLogAvailable } from '../data/playerActions.js';

/** @returns {boolean} Whether the current user gets the button controlled by a player setting. */
const showFor = (settingKey) => game.user.isGM || (questLogAvailable() && game.settings.get(MODULE_ID, settingKey));

const BUTTON_CLASS = 'fhql-open-log';

/**
 * Journal sidebar header button and scene control button. See docs/SCOPE.md 7.3.
 * Both fail silently if Foundry's UI changes shape.
 */
export function registerEntryPoints()
{
   Hooks.on('renderJournalDirectory', (app, element) =>
   {
      const slot = directoryButtonSlot(element);
      if (!slot) { return; }
      const existing = slot.parent.querySelector(`.${BUTTON_CLASS}`);
      if (!showFor('playerJournalButton')) { existing?.remove(); return; }
      if (existing) { return; }

      const label = game.i18n.localize('FHQL.QuestLog.Open');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = BUTTON_CLASS;
      button.dataset.tooltip = label;
      button.setAttribute('aria-label', label);
      button.innerHTML = `<i class="fa-solid fa-scroll" inert></i> ${game.i18n.localize('FHQL.QuestLog.Title')}`;
      button.addEventListener('click', (event) =>
      {
         event.preventDefault();
         event.stopPropagation();
         openQuestLog();
      });

      if (slot.prepend) { slot.parent.prepend(button); }
      else { slot.parent.append(button); }
   });

   Hooks.on('getSceneControlButtons', (controls) =>
   {
      const group = controls?.[SCENE_CONTROL_GROUP];
      if (!group?.tools) { return; }

      group.tools.fhqlQuestLog = {
         name: 'fhqlQuestLog',
         order: Object.keys(group.tools).length,
         title: 'FHQL.QuestLog.Open',
         icon: 'fa-solid fa-scroll',
         button: true,
         visible: showFor('playerSceneControl'),
         onChange: () => openQuestLog()
      };
   });
}
