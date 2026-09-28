import { SCENE_CONTROL_GROUP, directoryButtonSlot } from '../compat.js';
import { openQuestLog } from '../api.js';

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
      if (!slot || slot.parent.querySelector(`.${BUTTON_CLASS}`)) { return; }

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
         visible: true,
         onChange: () => openQuestLog()
      };
   });
}
