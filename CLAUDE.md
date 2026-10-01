# Fallhammer Quest Log: working notes

Read this first in any new session. The full design and every decision live in `docs/SCOPE.md`; this file is the orientation, the conventions, and the lessons that cost time to learn.

## What this is

A Foundry VTT **v14** quest log module (ID `fhql`, CSS prefix `fhql-`), built as a maintained replacement for Forien's Quest Log (FQL), with light, dark, sci-fi, gothic (Bloodborne-style), cabaret, and ledger (Tidy-style) themes and an FQL importer. Plain ES modules, no build step. Version 0.3.0. All work so far is on branch `claude/quirky-cray-tooyrk`, not yet merged or released.

## Working with the user

- The user has dyslexia: keep replies concise, plain, and forward-stated. Brevity is an accessibility need.
- Say what was verified and what wasn't. Nothing here can run inside Foundry; the user tests in their own v14 world and reports back with screenshots. Ask for console errors (F12) when something breaks.
- Commit and push after each coherent slice, with a clear message. Don't open a PR unless asked.

## Commands

```sh
npm run check      # lint + load + contrast + deposits. Run before every push; CI runs it on push too.
npm run layout     # renders templates at 110 widths/themes/modes (runs panels.js), fails on overflow
                   # set CHROMIUM_PATH (here: /opt/pw-browsers/chromium)
npm run load       # loads every module file with Foundry mocked; catches bad imports
npm run contrast   # WCAG AA check of theme tokens
npm run deposits   # deposit and reward rules with Foundry mocked: races, refusals, rollback, recipients, Undo
npm run quests     # quest family rules with Foundry mocked: subquests live in their parent's folder, move together, no loops
```

## Map

| Path | Role |
|---|---|
| `src/main.js` | init/ready hooks, document hooks that re-render UI |
| `src/compat.js` | **only** place for version-sensitive Foundry APIs |
| `src/data/QuestData.js` | `fhql.quest` JournalEntryPage TypeDataModel |
| `src/data/quests.js` | quest CRUD, access rules, folders, hide/reveal ownership |
| `src/data/relay.js` | GM relay: register, send, one shared queue, notifications |
| `src/data/rewards.js` | reward claiming (via relay) |
| `src/data/deposits.js` | objective item requirements; hand over / show (via relay) |
| `src/data/playerActions.js` | accept / propose / shared notes (via relay), visibility gating |
| `src/data/systemItems.js` | per game system: where item quantity lives (dnd5e, pf2e, daggerheart, cyphersystem), item source UUIDs |
| `src/data/owners.js` | which player an actor belongs to (assigned, else owner), shared actors, player actors |
| `src/data/notesLock.js` | one-at-a-time player notes editing (User flags) |
| `src/data/tracking.js` | personal Track and Beacon choice (User flags) |
| `src/data/lifecycle.js` | duplicate/delete consistency hooks |
| `src/import/fql.js` | FQL import (in place, parent repair, report) |
| `src/apps/QuestSheetMixin.js` | shared quest sheet core: render context, edit mode, field saves, drops, focus/save safety |
| `src/apps/sheet/objectives.js` | sheet feature: objectives, requirements, deposits (context + actions) |
| `src/apps/sheet/rewards.js` | sheet feature: rewards and claiming (context + actions) |
| `src/apps/sheet/notes.js` | sheet feature: player notes in place (context + actions) |
| `src/apps/sheet/questMenu.js` | sheet feature: GM quest menu (pop out, access, move, parent, delete) |
| `src/apps/sheet/panels.js` | panel heights (priority/proportional sharing), scroll keeping, narrow collapse; runs after every render |
| `src/apps/sheet/rows.js` | row lookups, `editorUnsaved`, `guardActions` (actions show a notice on failure) |
| `src/apps/QuestLog.js` | log window: folder tree, filters, search, right-click menu |
| `src/apps/QuestSheetApp.js` | pop-out quest window |
| `src/ui/QuestBeacon.js` | panel above the players list |
| `src/ui/motion.js` | window open/close motion (from/to the Beacon), reduced-motion fade |
| `src/ui/share.js` | Show to players: GM asks players' clients to open a quest (query) |
| `src/data/seen.js` | new-change dots: per-user seen times (server timestamps), baseline, batched writes |
| `src/ui/questPreview.js` | hover card for quest links (chat, journals) via Foundry's tooltip |
| `src/ui/popover.js` | in-window child panels (menus, pickers, confirms) |
| `src/theme.js` | theme class, texture strength, overlay images, fonts, Tidy banner color, live preview |
| `src/apps/TextureImagesApp.js` | GM window from Module Settings: header/lower wash image per theme |
| `styles/fhql.css` | Light tokens (default), then every component, tokens only |
| `styles/themes/*.css` | one file per other theme: tokens, then its few theme-only rules; listed in `module.json` |
| `styles/textures/` | our default wash images (drawn by `tools/make-washes.mjs`) |
| `tools/` | layout, load, and contrast checks; test fixtures |

## Rules that are easy to break

- **Imports:** one missing or misnamed import stops the whole module in Foundry and ESLint won't see it. `npm run load` catches it; always run `npm run check`.
- **Editing by slicing:** two bugs came from Python/regex cuts that ran past their end marker and deleted neighboring functions. After any cut, diff the file against the previous commit.
- **Panel layout:** the sheet's height is shared by `panels.js`, not CSS. Panel contents go inside `.fhql-panel-body[data-scroll=key]` on a `.fhql-card[data-panel=key]`; new panels need both, or they won't size or keep their scroll. Narrow-only rules live inside `@container fhql-sheet (max-width: 559px)`; a same-weight default rule later in the file beats an override inside an earlier container query.
- **Width containers:** never put `container-type` on an element that contains a text field or rich-text editor. Foundry's own form/editor styles collapse inside one. Containers sit only on the sheet, reward list, and subquest list. The layout test enforces this.
- **Rich-text editors:** use `<prose-mirror toggled>` without `open`. Adding `open` at render broke editing. Unsaved editor text is flushed on Done, on close, and on switching quests via `_flushEdits`. Only *open* editors count as unsaved (a just-saved toggled editor can still report dirty).
- **Player notes** are edited in place with a one-editor lock on User flags (`src/data/notesLock.js`), not in edit mode.
- **Handlebars helpers:** don't rely on `eq`/`and`/`or`; compute booleans in JS. `lookup` is fine.
- **GM relays** go through `src/data/relay.js` only (`registerRelay` / `relay`): one queue on the GM client for every request type, shared notifications, transport in `compat.js`. The handler isn't told who sent a request: re-check everything against the named user, and refuse requests naming a GM.
- **Deposits never move without confirmation:** Hand over/Show and drops open the confirm panel (source, amount). The GM client takes only what is still needed, one deposit at a time, recording before taking and rolling back on failure. Keep `npm run deposits` passing; it fails if the relay queue is removed.
- **Quest families** live in one folder: a new subquest is created in its parent's folder, setting a parent moves the quest there, moving a quest moves its subquests. The Quest Log also nests a subquest under its parent wherever it is stored (older data).
- **Hidden quests:** hiding sets default and per-player ownership to None (saved in a flag, restored on reveal); `questAccess` also refuses Hidden quests to non-GMs.
- **Sheet actions** are plain functions called with `this` as the window, grouped per feature in `src/apps/sheet/` and merged through `guardActions`. New feature: new file there, not more lines in the mixin.
- **Quick choices** use `src/ui/popover.js` child panels, never Foundry dialogs. Separate windows only for Pop out, FQL import, and Foundry's ownership editor.
- **Textures** are drawn at full strength and faded by a veil layer (`--fhql-veil`, from `--fhql-strength`); 50 is the theme as designed. Each texture site lists veil, overlay, then theme layers, with `background-size/position/repeat` lists at least as long as the layers: a short list repeats from its start and silently stops later layers tiling. A theme with several texture layers must give full-length `--fhql-texture-size` and `--fhql-texture-position` lists.
- **Colors** only through `--fhql-*` tokens; a theme changes colors and small shapes, never layout. A new theme is a new file in `styles/themes/` plus its entry in `module.json` `styles` (the tools read that list).
- **Selector lists** can hold commas inside `:is()`/`:has()`; any script that splits CSS must split on top-level commas only (a naive split once broke every Ledger rule; caught by a computed-style diff).
- **Manifest changes need a world relaunch.** Foundry reads `module.json` (styles, scripts, languages) only when a world launches; a browser refresh keeps the old list. Tell the user to Return to Setup and relaunch after any manifest change.
- **Offline tests can't load Foundry's CSS.** Visual checks here are approximations; the user's screenshots are the truth.

## Verified in Foundry by the user

Storage survives disable/re-enable; editing and autosave; view/edit modes; quick status actions; folders; Beacon sizing (with Carolingian/Classic UI); FQL import on real data; hidden quests hidden from players; Done commits editor text; Ledger theme beside Tidy (title bar, banner, quest image flush on top, Modesto name, follows a changed Tidy color); Sci-fi theme with a 5:1 quest image showing uncropped; after the audit refactor (relay, sheet split, CSS split): claiming, deposits, Edit notes, all themes, the rest.

## Waiting on the user

- GM notes privacy: as a player, `game.journal.get('ID').pages.contents.map(p => p.name)` should not list "GM notes".
- Claiming, Give, Undo; player workflow settings; font settings listing uploaded fonts; sci-fi hex texture; list textures; Dark art-deco fans (CSS-only); live theme preview from Module Settings; Beacon menu toggles closed on second click; Gothic theme; Texture strength (table slider, per-player override incl. Smooth, live preview, old "off" carried over); Theme images window (browse, defaults, off per theme), 5e washes when D&D 5e runs, our washes otherwise; Ledger lattice on heading bars and list toolbar, wash on the banner.
- Item requirements and deposits: hand over, show only, drag from a character sheet, Undo with return, and two players depositing at once (needs two browsers as different players). Item matching across systems (dnd5e/pf2e quantity). Hand over always confirms source and amount in a panel (starts on the assigned character; party inventory selectable); GM hand over from an NPC; quantity in each of the user's systems: D&D 5e, Cypher, Daggerheart, PF2e. Startup console line names the detected system.
- Rewards: Claim/Give confirm panel with any owned actor (party inventory); GM Give to any actor (NPCs credited to the GM); Undo "Take it back" (merged stacks reduced by the claimed amount; missing item still clears the claim).
- Pinned header and list toolbar; panels sized by priority and scrolling on their own (wide); one scroll with collapsible panels and Show all (narrow); scroll kept after ticking an objective; Hide done; editor toolbar pinned in edit mode; very short window falls back to whole-sheet scroll.
- Beacon toggle (open, restore if minimized, close log and quest windows) with rise/settle motion; no double animation with Foundry's close.
- Show players: GM picks everyone or one player; their quest window opens (needs a second browser as a player).
- Comforts: new-change dots (list, Beacon); objective glow and count tick; Beacon glow on finish; outcome chat card (public or whispered); window size/place memory; / to search, Esc clears; sliding folders; hover previews of quest links. Scroll no longer jumps when ticking an objective. Sci-fi hex texture. Gothic as Yharnam (soot/oxblood/brass/moonlight palette, spear finials, iron railing list) and the old warm Gothic as the new Cabaret theme (gilt trellis with sequins, footlights, velvet curtain list, gilt frames); needs a world relaunch (new style file).
- Player notes in place: Edit notes opens the editor in one click (auto-clicks the editor's pen; unverified), lock shown to a second user, GM Edit anyway, saved text stays visible after the editor's Save.

## Next up (see `docs/SCOPE.md` §11 milestones and §13 open decisions)

1. Theme polish leftovers: theme our windows' title bar (behind `compat.js`); extend the contrast check to buttons, hover/selected states, chips, panels, Beacon.
2. Nested objectives (schema has `parent`; no UI) and reordering objectives/rewards.
3. Quest links and hotbar macros opening our sheet directly (today they land on the journal page summary).
4. Sharing: compendium/Adventure import keeping parent links (IDs change), map pins tested.
5. Scale: index quests instead of scanning `game.journal` per render; time a 500-quest world.
6. Docs: screenshots, user guide. Then merge to a `main` branch and publish a `v0.3.0` release (workflow in `.github/workflows/release.yml`).

Quest image guidance (told to the user): shown full pane width, max 160px tall, cropped top and bottom only. Recommend 5:1, 2000×400, key content in the middle 60% of height. Per-quest banner tint declined (2026-10-01).

Audit leftovers (not yet done): Handlebars partials for the repeated eye button and notes lock controls; a settings submenu for the advanced settings; check Foundry's CSS layer list before adopting `@layer`; check whether notifications escape HTML.

Open decisions: drop the floating tracker (recommended; Beacon covers it); whether quest entries show in players' journal sidebar; sign-off on the permission map (§5.6); FQL macro API shim timing.
