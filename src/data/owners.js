/**
 * Who an actor belongs to, for deposits and rewards. A shared actor (a party inventory several
 * players own) belongs to whoever has it assigned, else its first player owner.
 */

const OWNER = () => CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;

/**
 * @param {Actor} actor - An actor.
 * @returns {User|undefined} The player it belongs to: whose assigned character it is, else a player owner.
 */
export function playerFor(actor)
{
   const players = game.users.filter((u) => !u.isGM);
   return players.find((u) => u.character?.id === actor.id) ?? players.find((u) => actor.testUserPermission(u, OWNER()));
}

/**
 * @param {Actor} actor - An actor.
 * @returns {boolean} Whether more than one player owns it, like a party inventory actor.
 */
export function sharedActor(actor)
{
   return game.users.filter((u) => !u.isGM && actor.testUserPermission(u, OWNER())).length > 1;
}

/**
 * @param {Actor} actor - An actor.
 * @returns {boolean} Whether it is some player's assigned character.
 */
export function assignedToSomeone(actor)
{
   return game.users.some((u) => !u.isGM && u.character?.id === actor.id);
}

/**
 * Every world actor, for the GM: assigned characters first, then other player-owned actors (a party
 * inventory), then the rest (NPCs, the GM's own characters).
 *
 * @returns {Actor[]} Actors.
 */
export function actorsForGM()
{
   const rank = (a) => (assignedToSomeone(a) ? 0 : playerFor(a) ? 1 : 2);
   return [...game.actors].sort((a, b) => rank(a) - rank(b));
}
