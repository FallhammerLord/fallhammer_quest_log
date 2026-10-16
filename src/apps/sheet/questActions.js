/**
 * Sheet feature: quest-level actions in the read view (status, party focus, tracking, accepting,
 * opening linked documents, clearing the giver). Called with `this` as the quest sheet.
 */
import { setStatus, clearGiver, questPage, updateQuest } from '../../data/quests.js';
import { isTracked, toggleTracked } from '../../data/tracking.js';
import { requestPlayerAction } from '../../data/playerActions.js';

/** @this {object} The quest sheet. */
async function onSetQuestStatus(event, target)
{
   if (!this.questEntry) { return; }
   await setStatus(this.questEntry, target.dataset.status);
   this._announce(game.i18n.format('FHQL.Announce.Status', { status: game.i18n.localize(`FHQL.Status.${target.dataset.status}`) }));
}

/** @this {object} The quest sheet. */
async function onToggleInProgress()
{
   const entry = this.questEntry;
   if (!entry) { return; }
   const on = !questPage(entry).system.inProgress;
   await updateQuest(entry, { 'system.inProgress': on });
   this._announce(game.i18n.localize(on ? 'FHQL.Announce.FocusOn' : 'FHQL.Announce.FocusOff'));
}

/** @this {object} The quest sheet. */
async function onAcceptQuest()
{
   if (!this.questEntry) { return; }
   const result = await requestPlayerAction({ action: 'accept', entryId: this.questEntry.id });
   if (result.ok)
   {
      ui.notifications.info(game.i18n.localize('FHQL.Player.Accepted'));
      this._announce(game.i18n.format('FHQL.Announce.Status', { status: game.i18n.localize('FHQL.Status.active') }));
   }
}

/** @this {object} The quest sheet. */
async function onToggleTracked()
{
   if (!this.questEntry) { return; }
   const on = !isTracked(this.questEntry);
   await toggleTracked(this.questEntry);
   this._announce(game.i18n.localize(on ? 'FHQL.Announce.TrackOn' : 'FHQL.Announce.TrackOff'));
}

/** Opens a linked giver or reward document's sheet, if the viewer may see it. */
async function onOpenDocument(event, target)
{
   const doc = target.dataset.uuid ? await fromUuid(target.dataset.uuid) : null;
   if (!doc?.testUserPermission?.(game.user, 'LIMITED'))
   {
      ui.notifications.info(game.i18n.localize('FHQL.Drop.CannotOpen'));
      return;
   }
   doc.sheet?.render({ force: true });
}

/** @this {object} The quest sheet. */
async function onClearGiver()
{
   if (this.questEntry) { await clearGiver(this.questEntry); }
}

export const questActions = {
   setQuestStatus: onSetQuestStatus,
   toggleInProgress: onToggleInProgress,
   toggleTracked: onToggleTracked,
   acceptQuest: onAcceptQuest,
   openDocument: onOpenDocument,
   clearGiver: onClearGiver
};
