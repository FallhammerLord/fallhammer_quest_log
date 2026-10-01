# Fallhammer Quest Log: working notes

Read this first in any new session. The full design and every decision live in `docs/SCOPE.md`; this file is the orientation, the conventions, and the lessons that cost time to learn.

## What this is

A Foundry VTT **v14** quest log module (ID `fhql`, CSS prefix `fhql-`), built as a maintained replacement for Forien's Quest Log (FQL), with light, dark, sci-fi, and gothic themes and an FQL importer. Plain ES modules, no build step. Version 0.3.0. All work so far is on branch `claude/quirky-cray-tooyrk`, not yet merged or released.

## Working with the user

- The user has dyslexia: keep replies concise, plain, and forward-stated. Brevity is an accessibility need.
- Say what was verified and what wasn't. Nothing here can run inside Foundry; the user tests in their own v14 world and reports back with screenshots. Ask for console errors (F12) when something breaks.
- Commit and push after each coherent slice, with a clear message. Don't open a PR unless asked.

## Commands

```sh
npm run check      # lint + module load + contrast. Run before every push.
npm run layout     # renders templates at 60 widths/themes/modes, fails on overflow
                   # set CHROMIUM_PATH (here: /opt/pw-browsers/chromium)
npm run load       # loads every module file with Foundry mocked; catches bad imports
npm run contrast   # WCAG AA check of theme tokens
```

## Map

| Path | Role |
|---|---|
| `src/main.js` | init/ready hooks, document hooks that re-render UI |
| `src/compat.js` | **only** place for version-sensitive Foundry APIs |
| `src/data/QuestData.js` | `fhql.quest` JournalEntryPage TypeDataModel |
| `src/data/quests.js` | quest CRUD, access rules, folders, hide/reveal ownership |
| `src/data/rewards.js` | reward claiming (GM-relayed query) |
| `src/data/playerActions.js` | accept / propose / shared notes (GM-relayed query), visibility gating |
| `src/data/tracking.js` | personal Track and Beacon choice (User flags) |
| `src/data/lifecycle.js` | duplicate/delete consistency hooks |
| `src/import/fql.js` | FQL import (in place, parent repair, report) |
| `src/apps/QuestSheetMixin.js` | shared quest sheet: context, actions, edits, focus/save safety |
| `src/apps/QuestLog.js` | log window: folder tree, filters, search, right-click menu |
| `src/apps/QuestSheetApp.js` | pop-out quest window |
| `src/ui/QuestBeacon.js` | panel above the players list |
| `src/ui/popover.js` | in-window child panels (menus, pickers, confirms) |
| `styles/fhql.css` | tokens per theme, then components using tokens only |
| `tools/` | layout, load, and contrast checks; test fixtures |

## Rules that are easy to break

- **Imports:** one missing or misnamed import stops the whole module in Foundry and ESLint won't see it. `npm run load` catches it; always run `npm run check`.
- **Editing by slicing:** two bugs came from Python/regex cuts that ran past their end marker and deleted neighboring functions. After any cut, diff the file against the previous commit.
- **Width containers:** never put `container-type` on an element that contains a text field or rich-text editor. Foundry's own form/editor styles collapse inside one. Containers sit only on the sheet, reward list, and subquest list. The layout test enforces this.
- **Rich-text editors:** use `<prose-mirror toggled>` without `open`. Adding `open` at render broke editing. Unsaved editor text is flushed on Done and on close via `_flushEdits`.
- **Handlebars helpers:** don't rely on `eq`/`and`/`or`; compute booleans in JS. `lookup` is fine.
- **GM relays** (`CONFIG.queries`): the handler isn't told who sent a request. Re-check everything against the named user, and refuse requests naming a GM.
- **Hidden quests:** hiding sets default and per-player ownership to None (saved in a flag, restored on reveal); `questAccess` also refuses Hidden quests to non-GMs.
- **Quick choices** use `src/ui/popover.js` child panels, never Foundry dialogs. Separate windows only for Pop out, FQL import, and Foundry's ownership editor.
- **Colors** only through `--fhql-*` tokens; a theme changes colors and small shapes, never layout.
- **Offline tests can't load Foundry's CSS.** Visual checks here are approximations; the user's screenshots are the truth.

## Verified in Foundry by the user

Storage survives disable/re-enable; editing and autosave; view/edit modes; quick status actions; folders; Beacon sizing (with Carolingian/Classic UI); FQL import on real data; hidden quests hidden from players; Done commits editor text.

## Waiting on the user

- GM notes privacy: as a player, `game.journal.get('ID').pages.contents.map(p => p.name)` should not list "GM notes".
- Claiming, Give, Undo; player workflow settings; font settings listing uploaded fonts; sci-fi knurl strength; list textures; Dark art-deco fans (CSS-only); live theme preview from Module Settings; Beacon menu toggles closed on second click; Gothic theme.

## Next up (see `docs/SCOPE.md` §11 milestones and §13 open decisions)

1. Theme polish leftovers: theme our windows' title bar (behind `compat.js`); extend the contrast check to buttons, hover/selected states, chips, panels, Beacon.
2. Nested objectives (schema has `parent`; no UI) and reordering objectives/rewards.
3. Quest links and hotbar macros opening our sheet directly (today they land on the journal page summary).
4. Sharing: compendium/Adventure import keeping parent links (IDs change), map pins tested.
5. Scale: index quests instead of scanning `game.journal` per render; time a 500-quest world.
6. Docs: screenshots, user guide. Then merge to a `main` branch and publish a `v0.3.0` release (workflow in `.github/workflows/release.yml`).

Open decisions: drop the floating tracker (recommended; Beacon covers it); whether quest entries show in players' journal sidebar; sign-off on the permission map (§5.6); FQL macro API shim timing.
