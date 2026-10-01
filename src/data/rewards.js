import { deleteKeyUpdate, postChat } from '../compat.js';
import { registerRelay, relay } from './relay.js';
import { MODULE_ID } from '../constants.js';
import { getQuestEntry, questAccess, questPage } from './quests.js';

/**
 * Reward claiming. See docs/SCOPE.md 5.10.
 *
 * Item rewards are copied onto the claimer's character and marked claimed. Actor rewards (followers,
 * mounts) give the claiming player ownership. Players can't always read the source documents, so
 * claims run on the GM's client through the relay (`fhql.claimReward`), one at a time.
 *
 * The relay doesn't tell the GM client who sent a request, so the GM side re-checks everything
 * against the named user: quest visible, reward unlocked and unclaimed, character owned.
 */

const RELAY = 'claimReward';
const { OWNER } = CONST.DOCUMENT_OWNERSHIP_LEVELS;

/** Registers the GM-side claim handler. Called on `init`. */
export function registerRewardQueries()
{
   registerRelay(RELAY, claimNow);
}

/**
 * Characters a user can receive rewards on: their assigned character first, then other actors they own.
 *
 * @param {User} user - The player.
 * @returns {Actor[]} Candidate actors.
 */
export function claimTargets(user)
{
   const owned = game.actors.filter((actor) => actor.testUserPermission(user, OWNER));
   const assigned = user.character;
   return assigned ? [assigned, ...owned.filter((a) => a.id !== assigned.id)] : owned;
}

/**
 * @param {object} reward - Reward data.
 * @returns {boolean} Whether this reward can be claimed at all (a linked item or actor).
 */
export function isClaimable(reward)
{
   return (reward.type === 'item' || reward.type === 'actor') && !!reward.uuid;
}

/**
 * @param {object} reward - Reward data.
 * @param {string} userId - A user ID.
 * @returns {boolean} Whether no more claims are allowed for this user.
 */
export function claimsExhausted(reward, userId)
{
   if (reward.claimLimit === 'perPlayer') { return reward.claims.some((c) => c.userId === userId); }
   return reward.claims.length > 0;
}

/**
 * Describes a claim for display: "Rinn (Kestrel)" or "Rinn".
 *
 * @param {object} claim - Claim data.
 * @returns {string} Label.
 */
export function claimLabel(claim)
{
   const user = game.users.get(claim.userId)?.name ?? game.i18n.localize('FHQL.Reward.UnknownPlayer');
   const actor = claim.actorUuid ? fromUuidSync(claim.actorUuid, { strict: false })?.name : null;
   return actor ? `${user} (${actor})` : user;
}

/**
 * Who can receive a reward. GMs choose from each player's assigned character; players choose among
 * the characters they own, assigned first.
 *
 * @param {object} reward - Reward data.
 * @param {boolean} asGM - Whether the GM is giving the reward.
 * @returns {{ userId: string, actorUuid: string, label: string, assigned: boolean }[]} Choices.
 */
export function recipientOptions(reward, asGM)
{
   const players = asGM ? game.users.filter((u) => !u.isGM) : [game.user];
   const options = [];
   for (const user of players)
   {
      if (claimsExhausted(reward, user.id)) { continue; }
      if (reward.type === 'actor') { options.push({ userId: user.id, actorUuid: '', label: user.name, assigned: false }); continue; }
      const targets = asGM ? (user.character ? [user.character] : []) : claimTargets(user);
      for (const actor of targets)
      {
         options.push({
            userId: user.id,
            actorUuid: actor.uuid,
            label: asGM ? `${user.name}: ${actor.name}` : actor.name,
            assigned: actor.id === user.character?.id
         });
      }
   }
   return options;
}

/**
 * Claims a reward: runs on this client if GM, otherwise asks the active GM's client.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} rewardId - Reward ID.
 * @param {{ userId: string, actorUuid: string }} recipient - Who receives it.
 * @returns {Promise<boolean>} Whether it succeeded.
 */
export async function requestClaim(entry, rewardId, recipient)
{
   const result = await relay(RELAY, { entryId: entry.id, rewardId, ...recipient },
      { needGM: 'FHQL.Reward.NeedGM', failed: 'FHQL.Reward.Failed' });
   return result.ok;
}

/**
 * @param {JournalEntry} entry - A quest entry.
 * @returns {boolean} Whether any player owns the quest. A player owner can edit its rewards, so
 *   players may not claim from it; the GM hands those rewards out with Give.
 */
export function playerOwned(entry)
{
   return Object.entries(entry.ownership).some(([id, level]) =>
      level >= OWNER && (id === 'default' || !game.users.get(id)?.isGM));
}

/**
 * GM side of a claim, run through the relay queue so two claims can't both take a one-time reward. Validates, copies the item or grants ownership, records the claim, posts a
 * chat card.
 *
 * @param {{ entryId: string, rewardId: string, userId: string, actorUuid: string }} data - Request.
 * @param {{ force?: boolean }} [options] - `force` skips lock and hidden checks (GM giving directly).
 * @returns {Promise<{ ok: boolean, message: string }>} Outcome.
 */
async function claimNow(data, { force = false } = {})
{
   const fail = (key) => ({ ok: false, message: game.i18n.localize(`FHQL.Reward.Error.${key}`) });
   if (!game.user.isGM) { return fail('NotGM'); }

   const entry = getQuestEntry(data.entryId);
   const page = questPage(entry);
   const reward = page?.system.rewards[data.rewardId];
   const user = game.users.get(data.userId);
   if (!entry || !reward || !user) { return fail('NotFound'); }
   // A request naming a GM can only come from a player posing as one: GMs give rewards directly
   // (force), and a GM owns every character, so the ownership check would pass for any target.
   if (!force && user.isGM) { return fail('NotOwner'); }
   if (!isClaimable(reward)) { return fail('NotClaimable'); }
   if (!force && playerOwned(entry)) { return fail('PlayerOwned'); }
   if (!force && (!questAccess(entry, user).full || reward.hidden || reward.locked)) { return fail('Locked'); }
   if (claimsExhausted(reward, user.id)) { return fail('AlreadyClaimed'); }

   const claim = { userId: user.id, actorUuid: '', itemUuid: '', prevLevel: null, at: Date.now() };
   const source = await fromUuid(reward.uuid);
   if (!source) { return fail('SourceMissing'); }
   if (reward.type === 'actor' && source.pack) { return fail('CompendiumActor'); }

   if (reward.type === 'item')
   {
      const actor = await fromUuid(data.actorUuid);
      if (!actor || actor.documentName !== 'Actor' || !actor.testUserPermission(user, OWNER)) { return fail('NotOwner'); }
      const itemData = source.toObject();
      delete itemData._id;
      foundry.utils.setProperty(itemData, `flags.${MODULE_ID}.fromQuest`, entry.id);
      const [created] = await actor.createEmbeddedDocuments('Item', [itemData]);
      claim.actorUuid = actor.uuid;
      claim.itemUuid = created?.uuid ?? '';
   }
   else
   {
      claim.prevLevel = source.ownership[user.id] ?? null;
      await source.update({ [`ownership.${user.id}`]: game.settings.get(MODULE_ID, 'followerOwnership') });
   }

   await page.update({ [`system.rewards.${data.rewardId}.claims`]: [...reward.claims, claim] });

   const who = claimLabel(claim);
   await postChat(game.i18n.localize('FHQL.QuestLog.Title'), `<div class="fhql-chat-claim">
         ${reward.img ? `<img src="${foundry.utils.escapeHTML(reward.img)}" alt="" width="36" height="36">` : ''}
         <p>${game.i18n.format('FHQL.Reward.ChatClaimed', {
            who: foundry.utils.escapeHTML(who), reward: foundry.utils.escapeHTML(reward.name), quest: foundry.utils.escapeHTML(entry.name)
         })}</p></div>`);

   return { ok: true, message: game.i18n.format('FHQL.Reward.Claimed', { reward: reward.name, who }) };
}

/**
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} rewardId - Reward ID.
 * @param {number} index - Index into the reward's claims.
 * @returns {Promise<Item|null>} The item a claim copied onto a character, if it still exists.
 */
export async function claimedItem(entry, rewardId, index)
{
   const claim = questPage(entry)?.system.rewards[rewardId]?.claims[index];
   return claim?.itemUuid ? (await fromUuid(claim.itemUuid)) ?? null : null;
}

/**
 * Undoes one claim. GM only. Restores a follower's previous ownership; removes the copied item only
 * when asked to.
 *
 * @param {JournalEntry} entry - The quest entry.
 * @param {string} rewardId - Reward ID.
 * @param {number} index - Index into the reward's claims.
 * @param {{ removeItem?: boolean }} [options] - Whether to also delete the copied item.
 */
export async function undoClaim(entry, rewardId, index, { removeItem = false } = {})
{
   if (!game.user.isGM) { return; }
   const page = questPage(entry);
   const reward = page?.system.rewards[rewardId];
   const claim = reward?.claims[index];
   if (!claim) { return; }

   if (reward.type === 'item' && removeItem) { await (await claimedItem(entry, rewardId, index))?.delete(); }
   else if (reward.type === 'actor')
   {
      const actor = await fromUuid(reward.uuid);
      if (actor)
      {
         await actor.update(claim.prevLevel === null
          ? deleteKeyUpdate('ownership', claim.userId)
          : { [`ownership.${claim.userId}`]: claim.prevLevel });
      }
   }

   const claims = reward.claims.filter((c, i) => i !== index);
   await page.update({ [`system.rewards.${rewardId}.claims`]: claims });
}

/**
 * Handles a reward dragged from a quest onto an actor sheet: claims it for that actor instead of
 * Foundry's plain item copy. Registered on `init`.
 */
export function registerRewardDrop()
{
   Hooks.on('dropActorSheetData', (actor, sheet, data) =>
   {
      const marker = data?.fhqlReward;
      if (!marker) { return; }
      const entry = getQuestEntry(marker.entryId);
      if (!entry) { return false; }
      const userId = game.user.isGM
       ? (game.users.find((u) => !u.isGM && actor.testUserPermission(u, OWNER))?.id ?? game.user.id)
       : game.user.id;
      requestClaim(entry, marker.rewardId, { userId, actorUuid: actor.uuid });
      return false;
   });
}

