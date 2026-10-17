import { SCENE_CONTROL_GROUP, directoryButtonSlot, pruneDirectory } from '../compat.js';
import { getQuestEntry, questPage, questRootFolder } from '../data/quests.js';
import { openQuestLog } from '../api.js';
import { questLogAvailable } from '../data/playerActions.js';
import { getSetting } from '../setting.js';

/** @returns {boolean} Whether the current user gets the button controlled by a player setting. */
const showFor = (settingKey) => game.user.isGM || (questLogAvailable() && getSetting(settingKey));

const BUTTON_CLASS = 'fhql-open-log';

/**
 * Journal sidebar header button and scene control button. See docs/SCOPE.md 7.3.
 * Both fail silently if Foundry's UI changes shape.
 */
export function registerEntryPoints()
{
   Hooks.on('renderJournalDirectory', (app, element) =>
   {
      // Players reach quests through the Quest Log and the Beacon; the journal list stays theirs.
      if (!game.user.isGM)
      {
         const root = questRootFolder();
         pruneDirectory(element instanceof HTMLElement ? element : app.element, (id) => id === root?.id, (id) => !!questPage(getQuestEntry(id)));
      }
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
      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-scroll';
      icon.inert = true;
      button.replaceChildren(icon, ` ${game.i18n.localize('FHQL.QuestLog.Title')}`);
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
