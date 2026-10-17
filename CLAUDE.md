# Fallhammer Quest Log: working notes

Read this first in any new session. The full design and every decision live in `docs/SCOPE.md`; this file is the orientation, the conventions, and the lessons that cost time to learn.

## What this is

A Foundry VTT **v14** quest log module (ID `fhql`, CSS prefix `fhql-`), built as a maintained replacement for Forien's Quest Log (FQL), with light, dark, sci-fi, gothic (Bloodborne-style), cabaret, hope and fear (Daggerheart-style), noir (Blades in the Dark), and ledger (Tidy-style) themes and an FQL importer. Plain ES modules, no build step. Version 0.3.0. `main` was created from branch `claude/quirky-cray-tooyrk` on 2026-10-17 (CI green); work continues on that branch. Not yet released (no GitHub release or tag).

## Working with the user

- The user has dyslexia: keep replies concise, plain, and forward-stated. Brevity is an accessibility need.
- Say what was verified and what wasn't. Nothing here can run inside Foundry; the user tests in their own v14 world and reports back with screenshots. Ask for console errors (F12) when something breaks.
- Commit and push after each coherent slice, with a clear message. Don't open a PR unless asked.

## Commands

```sh
npm run check      # lint + load + contrast + deposits + quests. Run before every push; CI runs it on push too.
npm run layout     # renders templates at 110 widths/themes/modes (runs panels.js), fails on overflow
                   # set CHROMIUM_PATH (here: /opt/pw-browsers/chromium)
npm run load       # loads every module file with Foundry mocked; catches bad imports
npm run contrast   # WCAG AA check of theme tokens: text, hover, filled buttons and status tags; notes edges under 3:1
npm run deposits   # deposit and reward rules with Foundry mocked: races, refusals, rollback, recipients, Undo
npm run quests     # Foundry mocked: quest families (folders, no loops), double-click lock, data upgrades, questPage safety
# In Foundry: install Quench, open it as GM, run "Fallhammer Quest Log: core" (real documents and data models).
```

## Map

| Path | Role |
|---|---|
| `src/main.js` | init/ready hooks, document hooks that re-render UI |
| `src/compat.js` | **only** place for version-sensitive Foundry APIs |
| `src/setting.js` | `getSetting` / `setSetting`: every read and write of our settings outside `settings.js` |
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
| `src/data/migrations.js` | world data upgrades: numbered steps, run once by the active GM on ready (setting `dataVersion`) |
| `src/data/lifecycle.js` | duplicate/delete consistency hooks |
| `src/import/fql.js` | FQL import (in place, parent repair, report) |
| `src/apps/QuestSheetMixin.js` | shared quest sheet core: edit mode, field saves, drops, focus/save safety, window memory |
| `src/apps/sheet/context.js` | the sheet's render data for one quest (each feature adds its part) |
| `src/apps/sheet/questActions.js` | sheet feature: status, Primary (stored as `inProgress`), track, accept, open linked document, clear giver |
| `src/apps/sheet/objectives.js` | sheet feature: objectives, requirements, deposits (context + actions) |
| `src/apps/sheet/rewards.js` | sheet feature: rewards and claiming (context + actions) |
| `src/apps/sheet/notes.js` | sheet feature: player notes in place (context + actions) |
| `src/apps/sheet/subquests.js` | sheet feature: add, open beside (one side slot per window), unlink (standalone or delete) |
| `src/apps/sheet/questMenu.js` | sheet feature: GM quest menu (show players, pop out on right-click only, access, move, parent, delete); the header's Pop out action |
| `src/apps/sheet/reorder.js` | sheet feature: reorder objectives and rewards in edit mode (drag the handle, or arrow keys); `reorderQuestList` saves |
| `src/apps/sheet/panels.js` | panel heights (priority/proportional sharing), scroll keeping, narrow collapse; runs after every render |
| `src/apps/sheet/rows.js` | row lookups, `editorUnsaved`, `guardActions` (actions show a notice on failure) |
| `src/apps/QuestLog.js` | log window: folder tree, filters, search, right-click menu |
| `src/apps/listTree.js` | list quest families: rows with ancestors in `data-chain` (folders, then parent quests), family summary and signals, folded state (`listFilter.collapsed` / `.expanded`, option `listFoldFinished`), ancestors for reveal |
| `src/apps/tips.js` | ? button in the Quest Log title bar and its tips panel (`templates/popovers/tips.hbs`) |
| `src/apps/listSplitter.js` | draggable/keyboard divider between list and quest; width in client setting `listWidth` (`--fhql-list-width`) |
| `src/apps/folderMenu.js` | GM folder menu in the log: new subfolder, rename, move into folder, delete (contents move up) |
| `src/apps/QuestSheetApp.js` | pop-out quest window |
| `src/ui/QuestBeacon.js` | panel above the players list |
| `src/ui/motion.js` | window open/close motion (from/to the Beacon), reduced-motion fade |
| `src/ui/share.js` | Show to players: GM asks players' clients to open a quest (query); the picker is `src/apps/sheet/share.js` |
| `src/data/seen.js` | new-change dots: per-user seen times (server timestamps), baseline, batched writes |
| `src/ui/questPreview.js` | hover card for quest links (chat, journals) via Foundry's tooltip |
| `src/ui/eggs.js` | theme easter eggs (Gothic bell on the Beacon, Cabaret curtain call, Sci-fi glitch on passive clicks); GM setting `easterEggs` |
| `src/ui/popover.js` | in-window child panels (menus, pickers, confirms); markup in `templates/popovers/` |
| `src/theme.js` | theme class, texture strength, overlay images, fonts, Tidy banner color, live preview |
| `src/apps/AdvancedSettingsApp.js` | GM window from Module Settings: `ADVANCED_SETTINGS` (easter eggs, ownership levels, reward unlocking, announcements, players' buttons); registered `config: false` in settings.js |
| `src/apps/TextureImagesApp.js` | GM window from Module Settings: header/lower wash image per theme |
| `styles/fhql.css` | Light tokens (default), textures, windows, shared pieces |
| `styles/components/*.css` | in load order: controls (generic buttons, inputs), list, sheet, Beacon, small windows, popovers, overrides (targets, scrollbars, smooth panels, title bars), high contrast, moments; tokens only. Order in `module.json` matters (later files win ties) and must match `STYLE_FILES` in `src/theme.js` |
| `styles/themes/*.css` | one file per other theme: tokens, then its few theme-only rules; listed in `module.json`. `light.css` holds only Light's shapes (its tokens are the defaults in fhql.css) |
| `styles/fonts/` | bundled heading fonts, each with its OFL licence: IM Fell English SC (Gothic), Josefin Sans (Dark), Oxanium (Sci-fi), Limelight (Cabaret), Cinzel (Hope and Fear), Courier Prime (Noir), plus Overpass as Hope and Fear's body font; listed in `BUNDLED_FONTS` in `src/theme.js`. Light uses Amiri, Ledger Modesto (both ship with Foundry) |
| `styles/textures/` | our default wash images (drawn by `tools/make-washes.mjs`) |
| `src/tests/quench.js` | in-world tests for the Quench module (real documents and data models; temporary quests, deleted after) |
| `tools/` | layout, load, and contrast checks; test fixtures |

## Rules that are easy to break

- **Imports:** one missing or misnamed import stops the whole module in Foundry and ESLint won't see it. `npm run load` catches it; always run `npm run check`.
- **Editing by slicing:** two bugs came from Python/regex cuts that ran past their end marker and deleted neighboring functions. After any cut, diff the file against the previous commit.
- **Comfort widths** (`SNAP_WIDTHS` on QuestLog and QuestSheetApp, `snapWidth` in `src/apps/minSize.js`) are tied to the CSS breakpoints (log stacks at 540, sheet goes two-column at 560, list 250px by default; players can widen it, so the log's snaps are a guide, not exact). Change one, check the other.
- **List rows hide by ancestors:** a quest row's `data-chain` holds its folders and then its parent quests; folding any of them hides it (`#applyListFilters`). New row kinds must carry a chain, and `listTree.js` lists quests caught in old parent loops at the top level so none vanish.
- **Panel layout:** the sheet's height is shared by `panels.js`, not CSS. Panel contents go inside `.fhql-panel-body[data-scroll=key]` on a `.fhql-card[data-panel=key]`; new panels need both, or they won't size or keep their scroll. Narrow-only rules live inside `@container fhql-sheet (max-width: 559px)`; a same-weight default rule later in the file beats an override inside an earlier container query.
- **Width containers:** never put `container-type` on an element that contains a text field or rich-text editor. Foundry's own form/editor styles collapse inside one. Containers sit only on the sheet, reward list, and subquest list. The layout test enforces this.
- **Rich-text editors:** use `<prose-mirror toggled>` without `open`. Adding `open` at render broke editing. Unsaved editor text is flushed on Done, on close, and on switching quests via `_flushEdits`. Only *open* editors count as unsaved (a just-saved toggled editor can still report dirty).
- **Player notes** are edited in place with a one-editor lock on User flags (`src/data/notesLock.js`), not in edit mode.
- **Sheet template context** sits under `sheet` (`{{#with sheet}}`); layout fixtures must add sheet fields there.
- **Tooltips** stay two to four words; details go in the tips panel (`src/apps/tips.js`). A screen-reader label may say more (separate key).
- **Handlebars helpers:** don't rely on `eq`/`and`/`or`; compute booleans in JS. `lookup` is fine.
- **Template pieces** used in more than one place live in `templates/partials/`, listed in `PARTIALS` (`src/constants.js`), loaded on init (`preloadTemplates`), and called by full path: `{{> "modules/fhql/templates/partials/eye-toggle.hbs" ...}}`. `npm run load` checks the list against the folder and the templates.
- **Timings** are named constants beside their use, saying what ties them down (a CSS animation length, a write batch).
- **Relay senders can't be verified** (checked 2026-10-16 against the Foundry type definitions: query handlers get only data and a timeout; module sockets carry no server-confirmed sender). A player with console access could name another player. Mitigations: every request is rechecked against the named user's own permissions, requests naming a GM are refused, and deposits and claims are recorded by name with GM Undo.
- **GM relays** go through `src/data/relay.js` only (`registerRelay` / `relay`): one queue on the GM client for every request type, shared notifications, transport in `compat.js`. The handler isn't told who sent a request: re-check everything against the named user, and refuse requests naming a GM.
- **Deposits never move without confirmation:** Hand over/Show and drops open the confirm panel (source, amount). The GM client takes only what is still needed, one deposit at a time, recording before taking and rolling back on failure. Keep `npm run deposits` passing; it fails if the relay queue is removed.
- **Quest families** live in one folder: a new subquest is created in its parent's folder, setting a parent moves the quest there, moving a quest moves its subquests. The Quest Log also nests a subquest under its parent wherever it is stored (older data).
- **Stored data changes shape → add a step to `MIGRATIONS`** in `src/data/migrations.js` (next version number), keep reading old data in `QuestData.migrateData` meanwhile, and add a case to `npm run quests`.
- **Never name a data field `parent`** (or any other DataModel property): Foundry's own `parent` (the owning document) hides it. The quest's parent is `system.parentQuest`; `QuestData.migrateData` carries old `parent` values over. This hid every subquest link until 2026-10-01; `npm run quests` mocks the collision.
- **`questPage(doc)` must stay safe for any document.** Drops pass Items and Actors through it; when it assumed `doc.pages`, every item drop on Objectives silently failed (2026-10-16). `npm run quests` checks it.
- **Redraws are batched** (`refresh` in `src/main.js`): document hooks queue the changed quest (and its parent, read at hook time) and one animation frame redraws the log, the affected quest windows, and the Beacon. Pass the entry ID; `null` means "redraw everything" (used when a parent changes).
- **Exclusive actions** (`EXCLUSIVE` in `src/apps/sheet/rows.js`) ignore repeat clicks on the same row while saving. Never add an action that opens a popover to that list: a second click must reach the popover to close it.
- **Notifications with names** (items, actors, users, quests) go through `notify()` in `compat.js`, which turns `<`/`>` into look-alike marks. Chat cards and popovers escape with `foundry.utils.escapeHTML`.
- **Hidden quests:** hiding sets default and per-player ownership to None (saved in a flag, restored on reveal); `questAccess` also refuses Hidden quests to non-GMs.
- **Sheet actions** are plain functions called with `this` as the window, grouped per feature in `src/apps/sheet/` and merged through `guardActions`. New feature: new file there, not more lines in the mixin.
- **Target sizes:** every button and select is at least 24px (WCAG 2.2 AA 2.5.8); icon-only actions use `.fhql-icon-only` (28px) with `aria-label` and `data-tooltip`.
- **Quick choices** use `src/ui/popover.js` child panels, never Foundry dialogs. Separate windows only for Pop out, FQL import, and Foundry's ownership editor.
- **Textures** are drawn at full strength and faded by a veil layer (`--fhql-veil`, from `--fhql-strength`); 50 is the theme as designed. Each texture site lists veil, overlay, then theme layers, with `background-size/position/repeat` lists at least as long as the layers: a short list repeats from its start and silently stops later layers tiling. A theme with several texture layers must give full-length `--fhql-texture-size` and `--fhql-texture-position` lists.
- **Heading fonts** are set with `!important` (Foundry's own h2/h3 rules outranked ours in v14, so theme and GM fonts never reached headings). To give a heading another face, set `--fhql-heading-face` on it, never `font-family` (Ledger's section bars do this for the body font).
- **Light/Dark shape selectors** use `.fhql-app:is(.fhql-theme-light, :where(...auto cases...))` so Follow Foundry gets them without raising specificity above (0,2,0).
- **High contrast** (`.fhql-hc-dark` / `.fhql-hc-light`, per-player setting `contrastMode`, hidden for now) overrides every theme's tokens with `!important` and turns textures off. Theme rules that color text or state with a literal (gilt ticks) need an HC override.
- **HTML lives in templates.** Window parts load through Foundry's `PARTS`; everything drawn on the spot (Beacon, child panels, chat cards, hover preview, curtain call) is in `TEMPLATES` (`src/constants.js`), preloaded on init and drawn without waiting by `renderTemplateNow` / `renderLoadedTemplate` (an async render could land redraws out of order). The offline checks load every template through `tools/templates.mjs`.
- **Beacon overlays** (new-change dot, easter-egg bell) sit on `.fhql-beacon`, outside `.fhql-beacon-panel`, which clips to its own shape. The Beacon redraws on any change: anything animated on it must survive a redraw (the bell carries `--fhql-toll-elapsed`).
- **Colors** only through `--fhql-*` tokens; a theme changes colors and small shapes, never layout. A new theme or component file goes in `module.json` `styles` (the tools read that list) and in `STYLE_FILES` in `src/theme.js` at the same place (loads a file Foundry missed before a relaunch, in order). Moving rules between files can change which rule wins a tie: compare computed styles before and after.
- **Image paths in CSS variables** must go through `cssUrl` / `assetUrl` (site-root addresses): a relative path set from code resolves against the stylesheet that uses the variable, so no overlay loaded until 2026-10-17. The same holds for a variable declared in a theme file: theme textures are embedded as data URIs, never file paths.
- **Template helpers:** only `localize` and core block helpers; Foundry's `{{checked}}` broke the Theme images window.
- **Selector lists** can hold commas inside `:is()`/`:has()`; any script that splits CSS must split on top-level commas only (a naive split once broke every Ledger rule; caught by a computed-style diff).
- **Manifest changes need a world relaunch.** Foundry reads `module.json` (styles, scripts, languages) only when a world launches; a browser refresh keeps the old list. Tell the user to Return to Setup and relaunch after any manifest change.
- **Offline tests can't load Foundry's CSS.** Visual checks here are approximations; the user's screenshots are the truth.

## Verified in Foundry by the user

Storage survives disable/re-enable; editing and autosave; view/edit modes; quick status actions; folders; Beacon sizing (with Carolingian/Classic UI); FQL import on real data; hidden quests hidden from players; Done commits editor text; Ledger theme beside Tidy (title bar, banner, quest image flush on top, Modesto name, follows a changed Tidy color); Sci-fi theme with a 5:1 quest image showing uncropped; after the audit refactor (relay, sheet split, CSS split): claiming, deposits, Edit notes, all themes, the rest.

## Waiting on the user

- GM notes privacy: as a player, `game.journal.get('ID').pages.contents.map(p => p.name)` should not list "GM notes".
- Claiming, Give, Undo; player workflow settings; font settings listing uploaded fonts; sci-fi hex texture; list textures; Dark art-deco fans (CSS-only); live theme preview from Module Settings; Beacon menu toggles closed on second click; Gothic theme; Texture strength (table slider, per-player override incl. Smooth, live preview, old "off" carried over); Theme images window (browse, defaults, off per theme), 5e washes when D&D 5e runs, our washes otherwise; Theme images now load (paths were resolving inside styles/components) and the menu button opens (`{{checked}}` replaced); Ledger in crimson/charcoal/black/silver with fan scales on heading bars, list toolbar and banner, wash on the banner. Hope and Fear as Daggerheart glass (translucent indigo 80% + blur, Overpass body, gold filled buttons, pill tags, Fear blue, sparks in the header band only; chosen from the look preview). Reordering objectives and rewards (grip/picture, arrow keys); Beacon capped at five objectives with scroll; quests hidden from players' journal sidebar. Quest families fold in the list (arrow, Alt for the whole family, fold-all button, Left/Right keys, count and signals on folded parents, guide lines, reveal when opened from elsewhere, dimmed parents for context under a filter), options Fold finished families and Active subquests first, resizable list pane.
- Item requirements and deposits: hand over, show only, drag from a character sheet, Undo with return, and two players depositing at once (needs two browsers as different players). Item matching across systems (dnd5e/pf2e quantity). Hand over always confirms source and amount in a panel (starts on the assigned character; party inventory selectable); GM hand over from an NPC; quantity in each of the user's systems: D&D 5e, Cypher, Daggerheart, PF2e. Startup console line names the detected system.
- Rewards: Claim/Give confirm panel with any owned actor (party inventory); GM Give to any actor (NPCs credited to the GM); Undo "Take it back" (merged stacks reduced by the claimed amount; missing item still clears the claim).
- Pinned header and list toolbar; panels sized by priority and scrolling on their own (wide); one scroll with collapsible panels and Show all (narrow); scroll kept after ticking an objective; Hide done; editor toolbar pinned in edit mode; very short window falls back to whole-sheet scroll.
- Beacon toggle (open, restore if minimized, close log and quest windows) with rise/settle motion; no double animation with Foundry's close.
- UI round (2026-10-17): Primary/Track naming, ? tips in the title bar, search by giver and objectives, "Showing N of M · Clear", delete confirms for objectives and rewards, Pop out on the header, Show players in ⋮; short tooltips; folder icon as fold toggle (open/closed, halo for black folders).
- Show players (now in ⋮): GM picks everyone or one player; their quest window opens (needs a second browser as a player).
- Comforts: new-change dots (list, Beacon); objective glow and count tick; Beacon glow on finish; outcome chat card (public or whispered); window size/place memory; / to search, Esc clears; sliding folders; hover previews of quest links. Scroll no longer jumps when ticking an objective. Sci-fi hex texture. Gothic as Yharnam (soot/oxblood/brass/moonlight palette, spear finials, iron railing list) and the old warm Gothic as the new Cabaret theme (gilt trellis with sequins, footlights, velvet curtain list, gilt frames); needs a world relaunch (new style file). Subquests (parentQuest rename): + Add and clicking a subquest open it beside the window it came from (one side slot per window: a second subquest replaces the first in place; nested ones open beside their parent; cascade when no room); unlink button (keep standalone or delete); drop a quest on Subquests or Objectives to make it a subquest; Hand over sits in the eye column; Set parent; nesting in the log. Beacon: switching quests moves an open log; clicking shows the Beacon's quest before closing. Gothic headings in bundled IM Fell English SC (declared from code only, `loadBundledFonts`, and registered in Foundry's font list via `registerFont`; no @font-face in CSS, where a second, broken declaration could win). Drop caps via `initial-letter` (top flush with the first line). Beacon menus float on the page (fixed position was thrown off by transformed ancestors). Theme heading fonts: Amiri (Light), Josefin Sans (Dark), Oxanium (Sci-fi), Limelight (Cabaret). Hope and Fear and Noir themes (new style files: relaunch). High contrast: built but hidden from Module Settings (`contrastMode` config: false) while it is re-prototyped; the user found it too flat (loses each theme's character). Themed title bars on our windows. Easter eggs: Gothic bell on the Beacon (last objective done), hunter tooltip at 3+ marked, Cabaret curtain call (third completion in a session), Sci-fi glitch (passive clicks, 1 in 20, 10 s silent cooldown, 400ms), GM off switch. Light and Dark shapes: bookbinder frames, ivy marks, fleuron (Light); gold deco brackets, sunburst fans, stepped diamond (Dark); both also on Follow Foundry. New light.css: relaunch (safety net loads it anyway). Cabaret loads even before a relaunch (console note). Comfort width snaps while resizing (log 560/830/1040, pop-out 420/580/760, within 20px; Shift resizes freely). Hand over as an icon button. Portrait frame setting (GM): round (default) or square, all themes; empty edit-mode drop slot stays square.
- Player notes in place: Edit notes opens the editor in one click (auto-clicks the editor's pen; unverified), lock shown to a second user, GM Edit anyway, saved text stays visible after the editor's Save.

## Next up (backlog, updated 2026-10-17; see `docs/SCOPE.md` §11 and §13). Much will shake out in play.

1. **Verify in play** (biggest risk): everything under "Waiting on the user", especially two-player cases (simultaneous deposits, Show players, notes lock) with a second browser as a player. The user can't run two-player tests yet; they'll shake out in play.
2. **Release v0.3.0:** merged to `main`; still to do: screenshots from the user's world, then publish a GitHub release tagged v0.3.0 (workflow in `.github/workflows/release.yml`). Waits on the user.
3. **Links and macros:** quest links and hotbar macros open our sheet directly (today they land on the journal page summary).

Backburner (user's call, 2026-10-17): high contrast take two (the user's colorblind player is fine today); scale past a few dozen quests (quest index, 500-quest timing); translations; compendium/Adventure import keeping parent links (only matters if someone publishes adventures with quests). Dropped: nested objectives; FQL macro shim (not needed). Parked themes: Biosynth, Numenera-style.

Quest image guidance (told to the user): shown full pane width, max 160px tall, cropped top and bottom only. Recommend 5:1, 2000×400, key content in the middle 60% of height. Per-quest banner tint declined (2026-10-01).

Decided 2026-10-17: no floating tracker (the Beacon covers it; it was never built); quests are hidden from players' journal sidebar (the Quest Log, Beacon and scene-control button are their way in); the permission map (§5.6) is signed off.
