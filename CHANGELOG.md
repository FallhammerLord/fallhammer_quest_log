# Changelog

## 0.3.0 (unreleased)

First feature-complete preview. Requires Foundry VTT v14.

- Quest Log with folders (inside the FHQL Quests journal folder), status filters, search, nested subquests, and a right-click quest menu.
- Quest sheet in the log or its own window: rich text, quest giver and reward drag-and-drop, GM-only notes, subquests, quest image, dates, read and edit modes with autosave.
- Quest Beacon above the players list: party Focus quests and personally tracked quests with their objectives, a switcher, and an empty state that opens the log.
- Reward claiming: items onto characters, actors as followers, GM Give and Undo, locks, per-player rewards, chat cards.
- Player workflows (GM settings): accept quests, propose quests, trusted status changes, shared player notes; hide the Quest Log from players; per-button toggles.
- Hidden quests hide from every player, including per-player access, restored on reveal.
- The quest header and list toolbar stay pinned; each quest panel scrolls on its own, with Objectives given room first. Narrow windows use one scroll with collapsible panels. Hide done on Objectives.
- The Beacon opens and closes the Quest Log (and its quest windows), with a short rise-and-settle motion.
- Gothic theme, after Bloodborne: soot, oxblood, tarnished brass and moonlight; quatrefoil tracery with iron spear finials, an iron-railing quest list, iron-framed panels with lancet marks, a cross divider and a red initial that stay when textures are off.
- Subquests work: adding or clicking one opens it beside its parent (a second subquest takes the first one's place; deeper ones open beside theirs), the log nests them, and the GM can unlink one as its own quest or delete it. (The parent link was hidden by a Foundry name clash; saved links carry over.)
- The Beacon leads the Quest Log: switching quests moves an open log, and clicking shows the Beacon's quest before closing.
- Gothic headings use IM Fell English SC (bundled, SIL Open Font License).
- Resizing settles on comfortable widths when you drag near them (hold Shift to resize freely).
- Quest giver portraits are round in every theme, or square by GM setting.
- Cabaret theme: wine velvet, gilt and footlights; a sequined harlequin trellis, a velvet-curtain quest list, gilt frames.
- Texture strength: a table slider set by the GM, with a per-player override (Smooth turns textures off). Theme images: header and lower washes per theme, D&D 5e's own when that system runs, or the GM's uploads. Ledger's lattice now runs across its panel headings and list toolbar.
- New-change dots, objective glows, an optional chat card when a quest is completed or failed, remembered window size, / to search, sliding folders, and hover previews of quest links.
- Show players: the GM opens a quest on players' screens, like Forien's Show.
- Player notes are edited in place from the read view, one person at a time; others see who is editing.
- Item requirements on objectives: players hand items over (or only show them) from their characters, by button or drag. Deposits take only what's still needed, so several players filling the last slots never lose items. GM Undo returns them.
- Import from Forien's Quest Log, in place, with parent/subquest repair and a report.
- Light, Dark (coffee with art-deco fans), Sci-fi, Gothic, and Ledger themes (Ledger is styled after Tidy 5e Sheets and takes its colors when Tidy is active); GM sets the world default, players can override. Theme and font choices preview live while Module Settings is open. Each player can turn theme textures off for smooth, flat panels.
- Responsive down to set minimum window sizes; child panels for quick choices; keyboard and screen-reader support.
