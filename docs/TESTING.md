# Testing in Foundry

What to check by hand in a v14 world. The offline checks (`npm run check`, `npm run layout`) can't run
Foundry itself; these steps cover what only a real world shows. Two-player cases need a second browser
logged in as a player. With the Quench module active, the GM can also run "Fallhammer Quest Log: core".

## Core checks

As GM:
- Empty log shows **Add sample quests**. It creates five quests in the **FHQL Quests** journal folder.
- **New quest** creates one, set to Hidden, and opens it for editing.
- Edit name, status, giver, description, objectives, and player notes. Changes save when you leave a field.
- **Done** returns to the read view. **Edit** reopens editing.
- In the read view: status buttons (Reveal, Start, Complete, Fail, Reopen) and clickable objective boxes, no edit mode needed.
- Click an objective's box to cycle open → done → failed.
- Toggle **Primary** and an objective's hide (eye) button.
- Delete a quest. Its subquests stay.

As a player (second browser or user):
- Hidden quests don't appear anywhere, including the journal sidebar.
- Changing a quest from Hidden to Available makes it appear, live.
- Hidden objectives don't show.
- Opening a quest from the journal sidebar shows a summary with **Open in Quest Log**.

Folders and filters:
- A parent quest's arrow folds its subquests; Alt-click folds the whole family; the button beside search folds or opens all. A folded parent shows "done/total" and a dot, star or bookmark when a subquest inside is new, primary or tracked. Left/Right arrows fold and open. Opening a subquest from the Beacon unfolds its parents. Drag the list's right edge to widen it (double-click resets).
- Right-click a folder (GM): New subfolder, Rename, Move into folder, Delete folder (its quests move up a level). Up to three levels below FHQL Quests.
- The journal folder is named **FHQL Quests** (an older "Quests" folder is renamed on load).
- **New folder** (folder-plus icon) creates a folder inside it. Drag quest rows onto a folder header to move them, or use ⋮ → Move to folder.
- Click a folder header to collapse it; the log remembers.
- Status chips filter the list; the search box filters by name, quest giver and objective as you type. As a player, a hidden objective's words find nothing. While filtering, "Showing N of M · Clear" appears; Clear resets chips and search.
- Delete an objective and remove a reward: each asks first.
- Rewards: lock and eye on the first line at the right; Claim/Give under the name, also in a narrow window.
- Configure Settings → Cross out done items: off removes the line on objectives, rewards and the Beacon; on brings it back.
- Log opens at 1040 × 920; list 350px by default (double-click the divider to reset); dragging settles on 250/350/500 (Shift: free); close and reopen the log: the width stays; New folder and fold-all at the left of the chips; chips show counts; long names wrap to two lines, and only cut names show a tooltip.
- Hide done is a toggle button in the Objectives heading.
- Item hand-ins: the item sits under the objective's text with a bracket; count and Hand over on the right; no repeated name when it matches; the people button folds "who handed in" open and shut. Filling the count leaves the objective open for the GM to tick.
- In the log, **Pop out** on the quest header opens it in its own window (not shown in a popped-out window). **Show players** is in the ⋮ menu; right-clicking a row also offers Pop out.
- The **?** in the Quest Log title bar opens tips (GM sees three more).
- Tooltips are short and don't cover neighboring rows much (fold toggle: "Fold or open (Alt: all)").
- Folders: the folder icon shows open or closed and fades between them as rows slide; a black folder stays visible on dark themes.
- Right-click a quest row (GM) for the quest menu. Quick choices (menus, pickers, confirmations) open as panels inside the window; Esc closes them.

Player workflows (world settings, off by default):
- **Players can accept quests**: players get Accept on Available quests; it becomes Active.
- **Players can propose quests**: players get New quest; theirs start as Available, owned by them.
- **Trusted players can change status**: trusted owners get the status buttons (not Hide/Reveal).
- **Players can edit player notes**: any player who can read a quest gets Edit notes.
- **Hide the Quest Log from players**, and per-button toggles for the Journal and Token-control buttons.
- Accept, propose, and shared notes need a GM connected.

Entry points:
- Journal tab shows a **Quest Log** button in its header, for GM and players.
- Token controls show a scroll button; clicking it opens the log and leaves the Token tool active.
- Mark a quest **Primary**: its name and all its objectives appear on the Quest Beacon above the players list, on every client that can see it. Clicking opens the log on that quest.
- Mark or track two quests: a switcher on the Beacon shows the count and lists them.
- Configure Settings has per-client toggles for the Beacon and its objectives.

Rewards and claiming:
- Drop an item or actor onto Rewards. Rewards start locked (lock icon). Click the lock to release one, or mark the quest Completed to release all (setting).
- As a player: **Claim** puts an item on your assigned character (or asks which); **Recruit** gives you access to an actor reward. Dragging an item reward onto your character sheet does the same.
- As GM: **Give** picks a player and character. Claimed items are struck through with "Claimed by…"; the ↺ button undoes a claim and asks before removing the item.
- The eye button on objectives and rewards hides or shows them, in read view too.

FQL import (if the world has Forien's Quest Log data):
- The log shows **Import from FQL (n)**. The preview lists every FQL quest.
- Import, then check: quests appear with objectives, rewards, giver, notes; subquests sit under parents; the report lists any fixes.
- Run it again: already-imported quests are skipped unless you tick Re-import.

Storage test (re-run after storage changes) (docs/SCOPE.md 5.2): with a quest created, disable the module, restart, check the journal entry still opens, then re-enable and check the quest is intact.
