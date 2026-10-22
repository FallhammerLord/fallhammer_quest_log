# Status

What the user has verified in Foundry, what waits on them, and the backlog. Moved out of CLAUDE.md on 2026-10-22 so it loads only when needed; CLAUDE.md keeps the rules.

## Verified in Foundry by the user

Storage survives disable/re-enable; editing and autosave; view/edit modes; quick status actions; folders; Beacon sizing (with Carolingian/Classic UI); FQL import on real data; hidden quests hidden from players; Done commits editor text; Ledger theme beside Tidy (title bar, banner, quest image flush on top, Modesto name, follows a changed Tidy color); Sci-fi theme with a 5:1 quest image showing uncropped; after the audit refactor (relay, sheet split, CSS split): claiming, deposits, Edit notes, all themes, the rest.

Checklist pass, 2026-10-17:
- UI round: ? tips, search by giver and objectives, "Showing N of M · Clear", delete confirms, Pop out on the header and Show players in ⋮, folder icons (black folders on dark themes), short tooltips.
- Items and rewards: hand over confirm panel (source, amount, assigned character first, party inventory); drag from a character sheet; Undo returns the item; GM hand over from an NPC; Claim/Give panels, GM Give to an NPC, Undo "Take it back".
- Two players: Show players opens the quest on the player's screen; GM notes page hidden from players (console check); new-change dots for players.
- List, sheet, Beacon: resizable list pane; reordering objectives and rewards; panels (pinned header, own scrolling, narrow collapse, Hide done, very short window); Beacon five-objective cap, toggle and motion; window memory and width snaps.
- Item hand-in layout (bracket, right-aligned count, folded "who handed in", name hidden when it matches) and no auto-tick: verified the same day.
- Polish pass (screenshot, same day): rewards layout (controls right, Claim/Give under the name), chip counts, New folder and fold-all in the filter row, Hide done button, hand-ins without the mode label, wrapped link buttons, fold tooltip opening upward, 1040 × 920 log with 350px list.
- Header and sizing (same day, deployed to the user's player server): 100px giver picture down the left edge, title/status/buttons beside it, Edit by ⋮, GM Pop out in ⋮; no jumping on redraws or theme changes; one status badge size; headings 16.4px. Small leftovers, not breaking: Ledger header has "a little strangery"; Sci-fi has no center ornament on the line between header and body (other themes do).
- Themes and settings: every theme; texture strength (slider, per-player override, live preview); Theme images window and font settings; easter eggs; portrait frame; player workflow settings, Advanced settings window, quests hidden from players' journal sidebar.

## Waiting on the user

Untested (2026-10-17):
- Show only (requirement in show mode: nothing is taken).
- Item quantities per system: D&D 5e, PF2e, Cypher, Daggerheart (startup console line names the system).
- Two players handing over at the same moment (needs a second browser as a player).
- Notes lock: a second user sees the lock; GM Edit anyway.
- Quest family folding: arrow, Alt for the whole family, fold-all button, Left/Right keys, signals on folded parents, unfold when opened from the Beacon.
- Options Fold finished families and Active subquests first.

New, not yet confirmed (2026-10-17): text sizes unified to heading/body/small in every theme (Sci-fi, Dark, Noir headings change most), 28px icon buttons, one picture size, list toolbar 28px; uniformity round (heading buttons, GM-only tag, subquest status badges at tally size; borderless unlink; list counts one size, finished family green; chip counts 12px; Undo icons centered; narrow Rewards heading says 1/3); tallies (boxed counts in panel headings and hand-ins, green once complete, 24px with their buttons; Hide done beside the count, icon-only in a narrow Objectives panel); list width remembered after closing and reopening the log; divider snaps; Cross out done items setting; two-line names with a tooltip only when cut.

Not on the checklist, unconfirmed: Edit notes opening the editor in one click; hover previews of quest links; the outcome chat card.

## Next up (backlog, updated 2026-10-17; see `docs/SCOPE.md` §11 and §13). Much will shake out in play.

1. **Verify in play:** the six untested items under "Waiting on the user"; the two-player ones (simultaneous hand over, notes lock) need a second browser as a player.
2. **Release v0.3.0:** merged to `main`; still to do: screenshots from the user's world, then publish a GitHub release tagged v0.3.0 (workflow in `.github/workflows/release.yml`). Waits on the user.
3. **Links and macros:** quest links and hotbar macros open our sheet directly (today they land on the journal page summary).

Backburner (user's call, 2026-10-17): high contrast take two (the user's colorblind player is fine today); scale past a few dozen quests (quest index, 500-quest timing); translations; compendium/Adventure import keeping parent links (only matters if someone publishes adventures with quests). Dropped: nested objectives; FQL macro shim (not needed). Parked themes: Biosynth, Numenera-style. No new themes for now (user, 2026-10-17): eight cover the genres; polish the ones we have.

Quest image guidance (told to the user): shown full pane width, max 160px tall, cropped top and bottom only. Recommend 5:1, 2000×400, key content in the middle 60% of height. Per-quest banner tint declined (2026-10-01).

Decided 2026-10-17: no floating tracker (the Beacon covers it; it was never built); quests are hidden from players' journal sidebar (the Quest Log, Beacon and scene-control button are their way in); the permission map (§5.6) is signed off.
