/**
 * Stress fixtures for tools/layout-check.mjs: long names, unbroken words, many rows, every reward state.
 * Shapes mirror what QuestSheetMixin._prepareSheet and QuestLog._prepareContext produce.
 */
const S = {
   active: 'fa-solid fa-person-walking', available: 'fa-solid fa-circle-question', hidden: 'fa-solid fa-eye-slash',
   completed: 'fa-solid fa-circle-check', failed: 'fa-solid fa-circle-xmark'
};
const OI = { open: 'fa-regular fa-square', done: 'fa-solid fa-square-check', failed: 'fa-solid fa-square-xmark' };

export function listContext(t, gm = true)
{
   const q = (id, name, status, depth, chain, inProgress = false) => ({
      id, uuid: `JournalEntry.${id}`, name, search: name.toLowerCase(), status, inProgress, depth, chain,
      statusIcon: S[status], statusLabel: t(`Status.${status}`), selected: id === 'a'
   });
   return {
      gm, hasQuests: true, query: '', fqlPending: gm ? 3 : 0,
      statusChips: Object.keys(S).map((k) => ({ status: k, icon: S[k], label: t(`Status.${k}`), active: false })),
      items: [
         q('t', 'Rumors at the Gate', 'available', 0, ''),
         { folder: true, id: 'f1', name: 'Act One: The Salt Roads of the Burning Pass', color: '#c9a24a', depth: 0, chain: '', count: 3 },
         q('p', 'The Salt Roads', 'active', 1, 'f1'),
         q('a', 'Extraordinarilyunbreakablequestnamewithoutspaces', 'active', 2, 'f1', true),
         q('c', 'Find the missing courier before the rains', 'available', 3, 'f1')
      ]
   };
}

export function sheetContext(t, { gm = true, editing = false } = {})
{
   const objectives = [
      ['Meet the caravan at Cinderford', 'done'], ['Clear the rockfall at the switchbacks before the autumn rains', 'open', true],
      ['Keepallsixwagonsintactwithoutanysinglebreakinthistext', 'failed'], ['Deliver the salt to Highmere', 'open']
   ].map(([name, state, hidden], i) => ({ id: `o${i}`, name, state, hidden, icon: OI[state], stateLabel: t(`Objective.${state}`) }));

   // An item requirement, part filled, with deposits from two players (see QuestSheet.#requirementContext).
   const mode = (m) => ({ value: m, selected: m === 'give', label: t(m === 'give' ? 'Deposit.ModeGive' : 'Deposit.ModeShow') });
   objectives.push({
      id: 'o4', name: 'Bring sealed salt casks from the Cinderford Warehouse Guild', state: 'open', icon: OI.open, stateLabel: t('Objective.open'),
      requirement: {
         uuid: 'Item.cask', name: 'Sealed salt cask (Cinderford Warehouse Guild)', img: '', count: 12, mode: 'give',
         progress: '7/12', fill: '58%', met: false, modeLabel: t('Deposit.ModeGive'), modeOptions: [mode('give'), mode('show')]
      },
      canDeposit: !editing, depositChoose: !gm, depositChooseLabel: 'Hand over from another character', depositVerb: t('Deposit.Give'), depositAria: t('Deposit.Give'), depositIcon: 'fa-hand-holding-hand',
      depositsList: [
         { index: 0, label: 'Player2 (Corvus AAI:2101 G5): 4', held: true, gm },
         { index: 1, label: 'Rinn (Kestrel of the Long Watch): 3', held: true, gm }
      ]
   });

   const reward = (id, over) => ({
      id, type: 'item', icon: 'fa-solid fa-gem', linked: true, uuid: `Item.${id}`, claimable: true, locked: false,
      claims: [], claimsList: [], claimVerb: t('Reward.Claim'), ...over
   });
   const rewards = gm ? [
      { id: 'r0', type: 'text', name: '40 gold, paid by Warden Hask on delivery', icon: 'fa-solid fa-coins', claims: [], claimsList: [] },
      reward('r1', { name: 'test equipment', canGive: true, draggable: true }),
      reward('r2', { name: 'Potion of Superior Healing (set of three)', struck: true, claims: [1], claimsList: [{ index: 0, label: 'Player2 (Corvus AAI:2101 G5)' }] }),
      reward('r3', { type: 'actor', name: 'Brannoc the Remarkably Stubborn Mule', icon: 'fa-solid fa-user', locked: true, hidden: true, canGive: true, perPlayer: true })
   ] : [
      reward('r1', { name: 'test equipment', canClaim: true }),
      reward('r2', { name: 'Potion of Superior Healing (set of three)', struck: true, claims: [1], claimsList: [{ index: 0, label: 'Player2 (Corvus AAI:2101 G5)' }] }),
      reward('r4', { name: 'Sealed letter from the Archivist of Highmere', showLocked: true })
   ];

   return {
      gm,
      sheet: {
         id: 'a', name: 'The Ember Road to Highmere Across the Burning Pass', gm, editable: gm, full: true, visible: true, editing,
         status: 'active', statusIcon: S.active, statusLabel: t('Status.active'),
         statusOptions: Object.keys(S).map((k) => ({ value: k, label: t(`Status.${k}`), selected: k === 'active' })),
         statusActions: gm ? [['completed', 'Complete'], ['failed', 'Fail'], ['hidden', 'Hide']]
          .map(([status, verb]) => ({ status, icon: S[status], label: t(`QuestLog.StatusAction.${verb}`) })) : [],
         inProgress: true,
         canSetStatus: gm,
         giver: { name: 'Warden Hask of the Cinderford Garrison', uuid: 'Actor.x', img: '', linked: true },
         parent: { id: 'p', name: 'The Salt Roads' },
         description: '<p>x</p>',
         descriptionHTML: '<p>Escort the salt caravan through the burned pass before the autumn rains close it for the season.</p>',
         objectives, doneCount: 1,
         rewards, rewardSummary: t('Reward.Summary').replace('{claimed}', '1').replace('{total}', '3'),
         subquests: [{ id: 'c', name: 'Find the missing courier before the rains', status: 'available', icon: S.available, label: t('Status.available') }],
         playerNotes: '', playerNotesHTML: '<p>Hask owes us 40 gold.</p>',
         canEditNotes: true, notesCanStart: gm, notesLockedBy: gm ? '' : 'Player2 (Corvus AAI:2101 G5) is editing',
         gmNotes: gm ? { raw: '', html: '<p>The rockfall was deliberate.</p>', open: true } : null,
         showHiddenNotice: false, showObjectives: true, showRewards: true, textRewardEditing: { text: editing }
      }
   };
}
