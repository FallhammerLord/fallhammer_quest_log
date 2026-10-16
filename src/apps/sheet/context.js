/**
 * The quest sheet's render data: everything the template shows for one quest, built from the quest,
 * the viewer's access, and the window's own state. Each feature adds its part (objectives, rewards,
 * notes); this file puts the sheet together.
 */
import { textEditor } from '../../compat.js';
import { STATUSES } from '../../constants.js';
import { isTracked } from '../../data/tracking.js';
import { canAccept, canChangeStatusAsPlayer, canEditNotesViaGM } from '../../data/playerActions.js';
import { getQuestEntry, gmNotesPage, questAccess, questPage, subquests } from '../../data/quests.js';
import { getSetting } from '../../setting.js';
import { objectivesContext } from './objectives.js';
import { rewardsContext } from './rewards.js';
import { notesContext } from './notes.js';

/** Narrow layout: objectives shown before "Show all". Matches the CSS cap in styles/fhql.css. */
const OBJECTIVE_CAP = 8;

/** One-click status changes in the read view, by current status. */
const STATUS_ACTIONS = {
   hidden: [['available', 'Reveal'], ['active', 'RevealActive']],
   available: [['active', 'Start'], ['completed', 'Complete'], ['failed', 'Fail'], ['hidden', 'Hide']],
   active: [['completed', 'Complete'], ['failed', 'Fail'], ['hidden', 'Hide']],
   completed: [['active', 'Reopen'], ['hidden', 'Hide']],
   failed: [['active', 'Reopen'], ['hidden', 'Hide']]
};

/**
 * Builds the render data for one quest.
 *
 * @param {object} app - The quest sheet (its edit mode and "Show all" choice).
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} saveStateLabel - The edit-mode save indicator ("Saved"), or ''.
 * @returns {Promise<object>} Sheet context.
 */
export async function sheetContext(app, entry, saveStateLabel)
{
   const page = questPage(entry);
   const system = page.system;
   const access = questAccess(entry);
   const editing = access.editable && app._editing;
   const trusted = canChangeStatusAsPlayer(entry);
   const notesViaGM = canEditNotesViaGM(entry);
   const enrich = (html) => textEditor().enrichHTML(html ?? '', { secrets: access.editable, relativeTo: page });
   const localize = (key) => game.i18n.localize(key);
   const allObjectives = objectivesContext(system, access, editing);
   // "Hide done" is the viewer's own choice; edit mode always shows everything.
   const hideDone = !editing && getSetting('hideDoneObjectives');
   const objectives = hideDone ? allObjectives.filter((o) => o.state !== 'done') : allObjectives;
   const doneCount = allObjectives.filter((o) => o.state === 'done').length;
   // Narrow layout shows the first few objectives with "Show all"; CSS applies the cap only when narrow.
   const objectivesCapped = !editing && !app._showAllObjectives && objectives.length > OBJECTIVE_CAP;
   const { rewards, rewardSummary } = rewardsContext(entry, system, access);

   const parentEntry = getQuestEntry(system.parentQuest);
   const parent = parentEntry && questAccess(parentEntry).visible ? { id: parentEntry.id, name: parentEntry.name } : null;

   const children = subquests(entry).map((child) =>
   {
      const status = questPage(child).system.status;
      return { id: child.id, name: child.name, status, icon: STATUSES[status].icon, label: localize(`FHQL.Status.${status}`) };
   });

   const gmPage = access.gm ? gmNotesPage(entry) : null;
   const gmNotesRaw = gmPage?.text.content ?? '';

   return {
      id: entry.id,
      name: entry.name,
      ...access,
      editing,
      status: system.status,
      statusIcon: STATUSES[system.status].icon,
      statusLabel: localize(`FHQL.Status.${system.status}`),
      statusOptions: Object.keys(STATUSES).filter((key) => access.gm || key !== 'hidden').map((key) => ({
         value: key, label: localize(`FHQL.Status.${key}`), selected: key === system.status
      })),
      statusActions: (access.gm || trusted) ? (STATUS_ACTIONS[system.status] ?? [])
       .filter(([target]) => access.gm || target !== 'hidden')
       .map(([target, verb]) => ({
          status: target, icon: STATUSES[target].icon, label: localize(`FHQL.QuestLog.StatusAction.${verb}`)
       })) : [],
      canSetStatus: access.gm || trusted,
      canAccept: canAccept(entry),
      ...notesContext(app, entry, access, notesViaGM),
      inProgress: system.inProgress,
      tracked: isTracked(entry),
      saveStateLabel: saveStateLabel,
      image: system.image,
      dateLine: dateLine(system),
      giver: { ...system.giver, linked: !!system.giver.uuid },
      parent,
      description: system.description,
      descriptionHTML: access.full ? await enrich(system.description) : '',
      objectives,
      doneCount,
      objectiveTotal: allObjectives.length,
      hideDone,
      hideDoneToggle: !editing && (doneCount > 0 || hideDone),
      allHidden: hideDone && allObjectives.length > 0 && objectives.length === 0,
      objectivesCapped,
      objectivesMoreLabel: game.i18n.format('FHQL.Objective.ShowAll', { count: objectives.length }),
      rewards,
      rewardSummary,
      subquests: children,
      showHiddenNotice: access.gm && system.status === 'hidden',
      showObjectives: allObjectives.length > 0 || editing,
      showRewards: rewards.length > 0 || editing,
      textRewardEditing: { text: editing },
      playerNotes: system.playerNotes,
      playerNotesHTML: access.full ? await enrich(system.playerNotes) : '',
      gmNotes: access.gm ? {
         raw: gmNotesRaw,
         html: await enrich(gmNotesRaw),
         open: editing || getSetting('gmNotesOpen')
      } : null
   };
}

/**
 * "Started 3 Oct 2026 · Completed 9 Oct 2026", from whichever dates are recorded.
 *
 * @param {object} system - Quest data.
 * @returns {string} The line, or '' if nothing is recorded.
 */
function dateLine(system)
{
   const format = (ts) => new Date(ts).toLocaleDateString(game.i18n.lang, { day: 'numeric', month: 'short', year: 'numeric' });
   const parts = [];
   if (system.dates.started) { parts.push(game.i18n.format('FHQL.Quest.Started', { date: format(system.dates.started) })); }
   if (system.dates.ended && ['completed', 'failed'].includes(system.status))
   {
      parts.push(game.i18n.format(`FHQL.Quest.Ended.${system.status}`, { date: format(system.dates.ended) }));
   }
   return parts.join(' · ');
}
