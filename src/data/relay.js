import { activeGM, queryUser, registerQuery } from '../compat.js';
import { MODULE_ID } from '../constants.js';

/**
 * The GM relay: players ask the active GM's client to do what their own permissions can't (claim a
 * reward, deposit an item, accept a quest). Used by rewards, deposits, and player actions.
 *
 * Every request runs on the GM client through one queue, one at a time, so no two can act on the
 * same data at once (two players claiming a one-time reward, or filling the last deposit slots).
 *
 * The query API doesn't tell the GM client who sent a request. Each handler must re-check
 * everything against the user the request names, and refuse requests naming a GM.
 */

/** @type {Map<string, Function>} Handlers by relay name. */
const handlers = new Map();

/** The GM client's queue: each request starts when the last one finishes. */
let queue = Promise.resolve();

/**
 * @param {Function} task - Work to run after everything already queued.
 * @returns {Promise<unknown>} Its result.
 */
function enqueue(task)
{
   const run = queue.then(task);
   queue = run.catch(() => {});
   return run;
}

/**
 * Registers a relayed request type. Called on `init`.
 *
 * @param {string} name - Short name; the query is `fhql.<name>`.
 * @param {(data: object, options: { force: boolean }) => Promise<{ ok: boolean, message?: string }>} handler -
 *   Runs on the GM client. `force` is true when a GM runs it for themselves (e.g. Give).
 */
export function registerRelay(name, handler)
{
   handlers.set(name, handler);
   registerQuery(`${MODULE_ID}.${name}`, (data) => enqueue(() => handler(data, { force: false })));
}

/**
 * Sends a request: runs it here if this user is a GM, else asks the active GM's client.
 *
 * @param {string} name - Relay name.
 * @param {object} data - Request data, naming the user it's for.
 * @param {object} messages - Localization keys.
 * @param {string} messages.needGM - Shown when no GM is connected.
 * @param {string} messages.failed - Shown when the request errors or times out.
 * @param {boolean} [messages.notifySuccess] - Also show the result message on success.
 * @returns {Promise<{ ok: boolean, message?: string }>} The outcome. Failures are already shown.
 */
export async function relay(name, data, { needGM, failed, notifySuccess = true })
{
   let result;
   if (game.user.isGM) { result = await enqueue(() => handlers.get(name)(data, { force: true })); }
   else
   {
      const gm = activeGM();
      if (!gm)
      {
         ui.notifications.warn(game.i18n.localize(needGM));
         return { ok: false };
      }
      try { result = await queryUser(gm, `${MODULE_ID}.${name}`, data); }
      catch (err)
      {
         console.error(`${MODULE_ID} | ${name} request failed`, err);
         result = { ok: false, message: game.i18n.localize(failed) };
      }
   }

   result ??= { ok: false, message: game.i18n.localize(failed) };
   if (!result.ok && result.message) { ui.notifications.warn(result.message); }
   else if (result.ok && notifySuccess && result.message) { ui.notifications.info(result.message); }
   return result;
}
