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
 * Actions that create or change data without asking first. While one is still saving, another click
 * on the same row (or the same button) is ignored, so a double-click never makes two quests or two
 * objectives. Actions that open a menu or confirm panel are left out: a second click on their button
 * is how that panel closes.
 */
const EXCLUSIVE = new Set([
   'addObjective', 'cycleObjective', 'toggleObjectiveHidden', 'clearRequirement',
   'addTextReward', 'toggleRewardLock', 'toggleRewardHidden', 'addSubquest',
   'setQuestStatus', 'toggleInProgress', 'toggleTracked', 'acceptQuest', 'clearGiver', 'finishEditing',
   'editNotes', 'finishNotes', 'createQuest', 'createSamples'
]);

/** Show the busy state only for actions slower than this (ms), so quick ones don't flicker. */
const BUSY_AFTER = 150;

/** @type {WeakMap<object, Set<string>>} Each window's exclusive actions still running, by key. */
const running = new WeakMap();

/**
 * @param {string} name - Action name.
 * @param {HTMLElement} [target] - The clicked control.
 * @returns {string} The action and the row (objective, reward, or quest) it acts on.
 */
function lockKey(name, target)
{
   const row = target?.closest?.('[data-objective-id], [data-reward-id], [data-quest-id]');
   return `${name}:${row?.dataset.objectiveId ?? row?.dataset.rewardId ?? row?.dataset.questId ?? ''}`;
}

/**
 * Wraps action handlers so a failure tells the user, instead of only reaching the console, and so an
 * exclusive action can't run twice at once on the same row (see EXCLUSIVE).
 *
 * @param {Record<string, Function>} actions - Handlers, called with `this` as the window.
 * @returns {Record<string, Function>} The same handlers, guarded.
 */
export function guardActions(actions)
{
   return Object.fromEntries(Object.entries(actions).map(([name, handler]) => [name, async function guarded(...args)
   {
      const exclusive = EXCLUSIVE.has(name);
      const target = args[1];
      const key = exclusive ? lockKey(name, target) : null;
      const busy = running.get(this) ?? new Set();
      if (exclusive)
      {
         if (busy.has(key)) { return undefined; }
         busy.add(key);
         running.set(this, busy);
      }
      const shown = exclusive && target?.classList ? setTimeout(() =>
      {
         target.classList.add('is-busy');
         target.setAttribute('aria-busy', 'true');
      }, BUSY_AFTER) : null;
      try { return await handler.apply(this, args); }
      catch (err)
      {
         console.error(`fhql | Action "${name}" failed`, err);
         ui.notifications.error(game.i18n.localize('FHQL.Error.Action'));
         return undefined;
      }
      finally
      {
         if (exclusive)
         {
            busy.delete(key);
            clearTimeout(shown);
            target?.classList?.remove('is-busy');
            target?.removeAttribute?.('aria-busy');
         }
      }
   }]));
}
