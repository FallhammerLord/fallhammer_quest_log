import { playersElement } from '../compat.js';
import { MODULE_ID } from '../constants.js';
import { openQuestLog } from '../api.js';
import { questAccess, questPage, visibleQuests } from '../data/quests.js';
import { applyTheme } from '../theme.js';

const WIDGET_ID = 'fhql-in-progress';

/**
 * The In Progress widget above Foundry's players list. See docs/SCOPE.md 7.2.
 * Our own element, inserted beside core's, never inside it. If the players list is missing, we skip.
 */
export function refreshInProgressWidget()
{
   const players = playersElement();
   let widget = document.getElementById(WIDGET_ID);

   const quests = game.settings.get(MODULE_ID, 'showInProgress')
    ? visibleQuests().filter((entry) => questPage(entry).system.inProgress)
    : [];

   if (!players || !quests.length)
   {
      widget?.remove();
      return;
   }

   if (!widget)
   {
      widget = document.createElement('section');
      widget.id = WIDGET_ID;
      widget.className = 'fhql-app fhql-widget';
      widget.addEventListener('click', (event) =>
      {
         const id = event.target.closest('[data-quest-id]')?.dataset.questId;
         if (id) { openQuestLog(id); }
      });
   }
   if (widget.nextElementSibling !== players) { players.before(widget); }

   applyTheme(widget);
   widget.innerHTML = renderWidget(quests);
}

/**
 * @param {JournalEntry[]} quests - In Progress quests the user can see. The first is shown.
 * @returns {string} Widget HTML.
 */
function renderWidget(quests)
{
   const [entry] = quests;
   const system = questPage(entry).system;
   const access = questAccess(entry);
   const escape = foundry.utils.escapeHTML;

   const next = access.full && game.settings.get(MODULE_ID, 'showNextObjective')
    ? system.objectiveList.find((objective) => objective.state === 'open' && (access.gm || !objective.hidden))
    : null;

   const hiddenMark = system.status === 'hidden'
    ? `<i class="fa-solid fa-eye-slash" data-tooltip="${game.i18n.localize('FHQL.Status.hidden')}"></i>` : '';
   const more = quests.length > 1
    ? `<span class="fhql-widget-more" data-tooltip="${escape(quests.slice(1).map((q) => q.name).join(', '))}">+${quests.length - 1}</span>`
    : '';
   const label = game.i18n.format('FHQL.Widget.Label', { name: entry.name });

   return `<button type="button" class="fhql-widget-button" data-quest-id="${entry.id}" aria-label="${escape(label)}">
      <span class="fhql-widget-title">
        <i class="fa-solid fa-star fhql-in-progress" inert></i>
        <span class="fhql-widget-name" data-tooltip="${escape(entry.name)}">${escape(entry.name)}</span>
        ${hiddenMark}${more}
      </span>
      ${next ? `<span class="fhql-widget-next">${escape(next.name)}</span>` : ''}
    </button>`;
}
