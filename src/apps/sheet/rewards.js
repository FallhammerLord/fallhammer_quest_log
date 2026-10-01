import { choicePanel, confirmPopover } from '../../ui/popover.js';
import {
   claimLabel, claimedItem, claimsExhausted, claimTargets, isClaimable, playerOwned, recipientOptions, requestClaim, undoClaim
} from '../../data/rewards.js';
import { addTextReward, deleteReward, updateQuest } from '../../data/quests.js';
import { rewardFor } from './rows.js';

/**
 * Quest sheet: rewards and claiming. Render data and actions. See docs/SCOPE.md 5.10.
 */

const REWARD_ICONS = { item: 'fa-solid fa-gem', actor: 'fa-solid fa-user', text: 'fa-solid fa-coins' };

/**
 * Render data for the rewards a viewer may see, and the "1 of 3 claimed" summary.
 *
 * @param {JournalEntry} entry - The quest.
 * @param {object} system - Quest data.
 * @param {object} access - From questAccess.
 * @returns {{ rewards: object[], rewardSummary: string }} Rewards.
 */
export function rewardsContext(entry, system, access)
{
   if (!access.full) { return { rewards: [], rewardSummary: '' }; }
   const userId = game.user.id;
   const gmHandsOut = playerOwned(entry);
   const rewards = Object.entries(system.rewards)
    .map(([id, r]) =>
    {
       const claimable = isClaimable(r);
       const exhaustedForAll = claimable && r.claimLimit === 'once' && r.claims.length > 0;
       const mine = claimable && claimsExhausted(r, userId);
       return {
          id, ...r,
          icon: REWARD_ICONS[r.type] ?? REWARD_ICONS.text,
          linked: !!r.uuid,
          claimable,
          struck: exhaustedForAll || (!access.gm && mine && r.type === 'item'),
          claimsList: r.claims.map((c, index) => ({ index, label: claimLabel(c) })),
          perPlayer: r.claimLimit === 'perPlayer',
          gmHandsOut: !access.gm && claimable && gmHandsOut && !mine,
          canClaim: !access.gm && claimable && !gmHandsOut && !r.locked && !mine
           && (r.type === 'actor' || claimTargets(game.user).length > 0),
          showLocked: !access.gm && claimable && r.locked && !gmHandsOut,
          canGive: access.gm && claimable && !exhaustedForAll,
          draggable: claimable && r.type === 'item' && (access.gm ? !exhaustedForAll : (!r.locked && !mine && !gmHandsOut)),
          claimVerb: game.i18n.localize(r.type === 'actor' ? 'FHQL.Reward.Recruit' : 'FHQL.Reward.Claim')
       };
    })
    .filter((r) => access.gm || !r.hidden)
    .sort((a, b) => a.sort - b.sort);
   const claimableRewards = rewards.filter((r) => r.claimable);
   const claimedCount = claimableRewards.filter((r) => r.claims.length > 0).length;
   return {
      rewards,
      rewardSummary: claimableRewards.length
       ? game.i18n.format('FHQL.Reward.Summary', { claimed: claimedCount, total: claimableRewards.length }) : ''
   };
}

/**
 * Confirms who receives a reward, in a child panel, even when there is only one choice. Starts on
 * the player's assigned character (or, for the GM, the first player character).
 *
 * @param {object} app - The quest sheet.
 * @param {object} reward - Reward data.
 * @param {boolean} asGM - Whether the GM is giving it.
 * @param {HTMLElement} anchor - The Claim or Give button.
 * @returns {Promise<object|null>} The chosen recipient.
 */
async function chooseRecipient(app, reward, asGM, anchor)
{
   const options = recipientOptions(reward, asGM);
   if (!options.length)
   {
      ui.notifications.warn(game.i18n.localize(asGM ? 'FHQL.Reward.NoRecipients' : 'FHQL.Reward.NoCharacter'));
      return null;
   }
   const t = (key) => game.i18n.localize(key);
   const hint = (o) => [
      o.assigned ? t(asGM ? 'FHQL.Deposit.PlayerCharacter' : 'FHQL.Deposit.YourCharacter') : '',
      o.shared ? t('FHQL.Deposit.Shared') : ''
   ].filter(Boolean).join(', ');
   const verb = t(asGM ? 'FHQL.Reward.Give' : (reward.type === 'actor' ? 'FHQL.Reward.Recruit' : 'FHQL.Reward.Claim'));
   const index = await choicePanel(app, anchor, {
      title: `${verb}: ${reward.name}`,
      label: t(reward.type === 'actor' ? 'FHQL.Reward.ToPlayer' : 'FHQL.Reward.ToActor'),
      choices: options.map((o) => (hint(o) ? `${o.label} (${hint(o)})` : o.label)),
      start: Math.max(0, options.findIndex((o) => o.assigned)),
      ok: verb
   });
   return index === null ? null : options[index];
}

/* ---------- Actions (called with `this` as the quest sheet) ---------- */

async function onAddTextReward()
{
   if (this.questEntry) { await addTextReward(this.questEntry); }
}

async function onDeleteReward(event, target)
{
   const found = rewardFor(this, target);
   if (found) { await deleteReward(this.questEntry, found.id); }
}

async function onToggleRewardLock(event, target)
{
   const found = rewardFor(this, target);
   if (found) { await updateQuest(this.questEntry, { [`system.rewards.${found.id}.locked`]: !found.reward.locked }); }
}

async function onToggleRewardHidden(event, target)
{
   const found = rewardFor(this, target);
   if (found) { await updateQuest(this.questEntry, { [`system.rewards.${found.id}.hidden`]: !found.reward.hidden }); }
}

async function onClaimReward(event, target)
{
   const found = rewardFor(this, target);
   if (!found) { return; }
   const recipient = await chooseRecipient(this, found.reward, false, target);
   if (recipient) { await requestClaim(this.questEntry, found.id, recipient); }
}

async function onGiveReward(event, target)
{
   const found = rewardFor(this, target);
   if (!found) { return; }
   const recipient = await chooseRecipient(this, found.reward, true, target);
   if (recipient) { await requestClaim(this.questEntry, found.id, recipient); }
}

/**
 * Undoes a claim (GM). For an item reward, offers to take the item back off the character: the
 * claimed amount from a larger stack, or the whole item.
 */
async function onUndoClaim(event, target)
{
   const found = rewardFor(this, target);
   if (!found) { return; }
   const index = Number(target.dataset.claimIndex);
   const claim = found.reward.claims[index];
   if (!claim) { return; }
   let takeBack = false;
   if (found.reward.type === 'item')
   {
      const item = await claimedItem(this.questEntry, found.id, index);
      const escape = foundry.utils.escapeHTML;
      const message = item
       ? game.i18n.format('FHQL.Reward.UndoItem', { item: escape(item.name), actor: escape(item.parent?.name ?? claim.actorName) })
       : game.i18n.format('FHQL.Reward.UndoItemMissing', { item: escape(found.reward.name), actor: escape(claim.actorName || claimLabel(claim)) });
      const answer = await confirmPopover(this, target, {
         message: `<p>${message}</p>`,
         yes: game.i18n.localize(item ? 'FHQL.Reward.TakeBack' : 'FHQL.Reward.UndoAnyway'),
         no: item ? game.i18n.localize('FHQL.Reward.LeaveIt') : undefined,
         danger: !!item
      });
      if (answer === null || (!item && !answer)) { return; }
      takeBack = !!item && answer;
   }
   const result = await undoClaim(this.questEntry, found.id, index, { takeBack });
   if (result.tookBack) { ui.notifications.info(game.i18n.format('FHQL.Reward.TookBack', { item: found.reward.name })); }
}

/** Reward and claim actions, merged into the quest sheet's actions. */
export const rewardActions = {
   addTextReward: onAddTextReward,
   deleteReward: onDeleteReward,
   toggleRewardLock: onToggleRewardLock,
   toggleRewardHidden: onToggleRewardHidden,
   claimReward: onClaimReward,
   giveReward: onGiveReward,
   undoClaim: onUndoClaim
};
