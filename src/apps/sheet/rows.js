import { questPage } from '../../data/quests.js';

/**
 * Finds the objective or reward a clicked control belongs to, by the row's data attribute.
 * Shared by the quest sheet's feature files.
 */

/**
 * @param {object} app - The quest sheet.
 * @param {HTMLElement} target - A control inside an objective row.
 * @returns {{ id: string, objective: object }|undefined} The objective.
 */
export function objectiveFor(app, target)
{
   const id = target.closest('[data-objective-id]')?.dataset.objectiveId;
   const objective = id ? questPage(app.questEntry)?.system.objectives[id] : undefined;
   return objective ? { id, objective } : undefined;
}

/**
 * @param {object} app - The quest sheet.
 * @param {HTMLElement} target - A control inside a reward row.
 * @returns {{ id: string, reward: object }|undefined} The reward.
 */
export function rewardFor(app, target)
{
   const id = target.closest('[data-reward-id]')?.dataset.rewardId;
   const reward = id ? questPage(app.questEntry)?.system.rewards[id] : undefined;
   return reward ? { id, reward } : undefined;
}

/**
 * Only an open editor can hold unsaved text. A toggled editor that was just saved can still report
 * dirty; counting it blocked the re-render, so the saved text vanished until Done.
 *
 * @param {HTMLElement} editor - A prose-mirror element.
 * @returns {boolean} Whether it holds unsaved changes.
 */
export function editorUnsaved(editor)
{
   return editor.open !== false && !!editor.isDirty?.();
}

/**
 * Wraps action handlers so a failure tells the user, instead of only reaching the console.
 *
 * @param {Record<string, Function>} actions - Handlers, called with `this` as the window.
 * @returns {Record<string, Function>} The same handlers, guarded.
 */
export function guardActions(actions)
{
   return Object.fromEntries(Object.entries(actions).map(([name, handler]) => [name, async function guarded(...args)
   {
      try { return await handler.apply(this, args); }
      catch (err)
      {
         console.error(`fhql | Action "${name}" failed`, err);
         ui.notifications.error(game.i18n.localize('FHQL.Error.Action'));
      }
   }]));
}
