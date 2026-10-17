# Changelog

## 0.3.0 (unreleased)

First feature-complete preview. Requires Foundry VTT v14.

- Quest families fold in the list: the arrow beside a parent quest hides its subquests (Alt: the whole family; a toolbar button folds or opens all). A folded parent shows how many are done and any new, tracked or party-focus subquest inside; guide lines tie subquests to their parent; opening a subquest from the Beacon or a link unfolds its parents; Left and Right arrows fold and open. Options: fold finished families, and list active subquests first. The list pane can be widened by dragging its edge.
- Hope and Fear follows the Daggerheart system's own sheets: frosted indigo glass over the scene, Overpass text under Cinzel titles, gold filled buttons and pill status tags, Fear in blue, and duality sparks in the quest header. Solid when Foundry's no-blur option is on.
- Advanced settings: easter eggs, ownership levels, reward unlocking, chat announcements and the players' Quest Log buttons move to their own window, keeping Module Settings short.
- Players' journal sidebar no longer lists quests or the FHQL Quests folder; players reach quests through the Quest Log and the Beacon.
- The Beacon shows up to five objectives; more scroll inside it, and a redraw keeps the scroll.
- Reorder objectives and rewards in edit mode: drag the grip (objectives) or the picture (rewards), or focus it and press the up or down arrow.
- Nested quest folders: the GM right-clicks a folder to add a subfolder, rename, move it into another folder, or delete it (its quests move up a level). Up to three levels, as Foundry allows.
- A GM handing over from a sheet several players share chooses who gave it.
- Theme images work: overlays (the default washes on Light and Ledger, and the GM's own) now load, and the Theme images button in Module Settings opens its window.
- Ledger is now crimson, charcoal, black and silver, with 1920s fan scales on its banner, section bars and list toolbar.
- Row borders and focus rings no longer clip at the edge of a scrolling panel; the editor's pen button is centered.
- Quest Log with folders (inside the FHQL Quests journal folder), status filters, search, nested subquests, and a right-click quest menu.
- Quest sheet in the log or its own window: rich text, quest giver and reward drag-and-drop, GM-only notes, subquests, quest image, dates, read and edit modes with autosave.
- Quest Beacon above the players list: party Focus quests and personally tracked quests with their objectives, a switcher, and an empty state that opens the log.
- Reward claiming: items onto characters, actors as followers, GM Give and Undo, locks, per-player rewards, chat cards.
- Player workflows (GM settings): accept quests, propose quests, trusted status changes, shared player notes; hide the Quest Log from players; per-button toggles.
- Hidden quests hide from every player, including per-player access, restored on reveal.
- The quest header and list toolbar stay pinned; each quest panel scrolls on its own, with Objectives given room first. Narrow windows use one scroll with collapsible panels. Hide done on Objectives.
- The Beacon opens and closes the Quest Log (and its quest windows), with a short rise-and-settle motion.
- Gothic theme, after Bloodborne: soot, oxblood, tarnished brass and moonlight; quatrefoil tracery with iron spear finials, an iron-railing quest list, iron-framed panels with lancet marks, a cross divider and a red initial that stay when textures are off.
- Subquests work: adding or clicking one opens it beside its parent (a second subquest takes the first one's place; deeper ones open beside theirs), the log nests them, the GM can unlink one as its own quest or delete it, and dropping a quest on Subquests or Objectives makes it a subquest. (The parent link was hidden by a Foundry name clash; saved links carry over.)
- The Beacon leads the Quest Log: switching quests moves an open log, and clicking shows the Beacon's quest before closing.
- Our windows' title bars follow the theme.
- Hope and Fear theme (after Daggerheart's styling: indigo, Hope gold, Fear violet, duality sparks gathering where Hope's glow meets Fear's) and Noir theme (for Blades in the Dark: graphite, blinds and rain, a typed case file).
- Sturdier under fast clicking: a double-click can't run a data-changing action twice, redraws are batched and limited to affected windows, and the latest quest click wins.
- An open rich-text editor gets the free space in its column.
- World data upgrades run once per world (data version), with in-world Quench tests for GMs who use Quench.
- Easter eggs in Gothic, Cabaret and Sci-fi (rare, visual only; the GM can turn them off).
- Each theme has its own heading font: Amiri (Light), Josefin Sans (Dark), Oxanium (Sci-fi), IM Fell English SC (Gothic), Limelight (Cabaret), Modesto (Ledger); the bundled ones are SIL Open Font License. Light and Dark gain their own panel shapes (bookbinder and art deco).
- Gothic headings use IM Fell English SC (bundled, SIL Open Font License), registered with Foundry so it also appears in font pickers.
- Resizing settles on comfortable widths when you drag near them (hold Shift to resize freely).
- Quest giver portraits are round in every theme, or square by GM setting.
- Cabaret theme: wine velvet, gilt and footlights; a sequined harlequin trellis, a velvet-curtain quest list, gilt frames.
- Texture strength: a table slider set by the GM, with a per-player override (Smooth turns textures off). Theme images: header and lower washes per theme, D&D 5e's own when that system runs, or the GM's uploads. Ledger's texture runs across its panel headings and list toolbar.
- New-change dots, objective glows, an optional chat card when a quest is completed or failed, remembered window size, / to search, sliding folders, and hover previews of quest links.
- Show players: the GM opens a quest on players' screens, like Forien's Show.
- Player notes are edited in place from the read view, one person at a time; others see who is editing.
- Item requirements on objectives: players hand items over (or only show them) from their characters, by button or drag. Deposits take only what's still needed, so several players filling the last slots never lose items. GM Undo returns them.
- Import from Forien's Quest Log, in place, with parent/subquest repair and a report.
- Light, Dark (coffee with art-deco fans), Sci-fi, Gothic, and Ledger themes (Ledger is styled after Tidy 5e Sheets and takes its colors when Tidy is active); GM sets the world default, players can override. Theme and font choices preview live while Module Settings is open. Each player can turn theme textures off for smooth, flat panels.
- Responsive down to set minimum window sizes; child panels for quick choices; keyboard and screen-reader support.
