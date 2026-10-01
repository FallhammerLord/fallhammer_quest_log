import { confirmPopover, menuPopover } from '../../ui/popover.js';
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
 * Chooses a recipient in a child panel. A player with an assigned character skips the choice.
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
   if (!asGM && (options.length === 1 || options[0].assigned)) { return options[0]; }
   const choice = await menuPopover(app, anchor, {
      title: game.i18n.format(asGM ? 'FHQL.Reward.GiveTo' : 'FHQL.Reward.ClaimFor', { reward: reward.name }),
      items: options.map((o, i) => ({
         value: String(i), label: o.label, icon: reward.type === 'actor' ? 'fa-solid fa-user' : 'fa-solid fa-user-shield',
         hint: o.assigned && !asGM ? game.i18n.localize('FHQL.Reward.Assigned') : ''
      }))
   });
   return choice === null ? null : options[Number(choice)];
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

async function onUndoClaim(event, target)
{
   const found = rewardFor(this, target);
   if (!found) { return; }
   const index = Number(target.dataset.claimIndex);
   const item = found.reward.type === 'item' ? await claimedItem(this.questEntry, found.id, index) : null;
   let removeItem = false;
   if (item)
   {
      const answer = await confirmPopover(this, target, {
         message: `<p>${game.i18n.format('FHQL.Reward.UndoItem', {
            item: foundry.utils.escapeHTML(item.name), actor: foundry.utils.escapeHTML(item.parent?.name ?? '')
         })}</p>`,
         yes: game.i18n.localize('FHQL.Reward.RemoveItem'),
         no: game.i18n.localize('FHQL.Reward.KeepItem'),
         danger: true
      });
      if (answer === null) { return; }
      removeItem = answer;
   }
   await undoClaim(this.questEntry, found.id, index, { removeItem });
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
