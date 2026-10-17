import { notify } from '../../compat.js';
import { menuPopover } from '../../ui/popover.js';
import { showablePlayers, showToPlayers } from '../../ui/share.js';

/**
 * Quest menu: the GM's Show players choice. Picks everyone who can see the quest, or one player,
 * and opens the quest window on their screens.
 */

/**
 * Show to players (GM, from the quest menu).
 *
 * @param {object} app - The window the picker opens in.
 * @param {JournalEntry} entry - The quest.
 * @param {HTMLElement|{ x: number, y: number }} anchor - Where to open the picker.
 */
export async function showQuestToPlayers(app, entry, anchor)
{
   if (!entry) { return; }
   const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
   const players = showablePlayers(entry);
   if (!players.length)
   {
      ui.notifications.warn(t('FHQL.Share.NoOne'));
      return;
   }
   const choice = await menuPopover(app, anchor, {
      title: t('FHQL.Share.Title'),
      items: [
         { value: '__all', label: t('FHQL.Share.Everyone', { count: players.length }), icon: 'fa-solid fa-users' },
         ...players.map((u) => ({ value: u.id, label: u.name, icon: 'fa-solid fa-user', hint: u.character?.name ?? '' }))
      ]
   });
   if (choice === null) { return; }
   const users = choice === '__all' ? players : players.filter((u) => u.id === choice);
   const { shown, missed } = await showToPlayers(entry, users);
   if (shown.length) { notify('info', t('FHQL.Share.Shown', { names: shown.map((u) => u.name).join(', ') })); }
   if (missed.length) { notify('warn', t('FHQL.Share.Missed', { names: missed.map((u) => u.name).join(', ') })); }
}
