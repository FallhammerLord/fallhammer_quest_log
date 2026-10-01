# Fallhammer Quest Log

A quest log for Foundry VTT v14 with light, dark, sci-fi, gothic, and ledger (Tidy 5e style) themes, item turn-ins on objectives, reward claiming, and import from Forien's Quest Log.

**Status:** feature-complete preview (0.3.0). Requires Foundry VTT v14. See [CHANGELOG.md](CHANGELOG.md).

Scope, design, and decisions live in [`docs/SCOPE.md`](docs/SCOPE.md).

## Install

In Foundry: **Add-on Modules → Install Module**, paste this manifest URL, and install:

```
https://github.com/FallhammerLord/fallhammer_quest_log/releases/latest/download/module.json
```

This works once a GitHub release has been published (see Releasing below).

## Try it (development)

1. Clone this repo into your Foundry data folder as `Data/modules/fhql`. The folder name must match the module ID.
   ```sh
   cd <FoundryData>/Data/modules
   git clone https://github.com/FallhammerLord/fallhammer_quest_log.git fhql
   ```
2. Restart Foundry, open a world, and enable **Fallhammer Quest Log** in Manage Modules.
3. Open the Quest Log any of these ways:
   - **Quest Log** button at the top of the Journal sidebar tab.
   - Scroll icon in the Token controls (left toolbar). Doesn't change the active layer.
   - The Focus quest above the players list (appears once a quest is marked Focus).
   - A key you bind in Configure Controls → Fallhammer Quest Log → Open Quest Log.
   - Macro: `game.modules.get('fhql').api.openQuestLog()`
4. Themes: the GM sets "Quest Log theme (world default)"; each player can override it with "Quest Log theme (just you)", and can turn "Theme textures" off for flat panels. Ledger takes Tidy 5e Sheets' colors when Tidy is active.
5. Quest image: shown as a banner across the top of the quest, up to 160 px tall and cropped top and bottom only. Use 5:1 (2000 × 400) and keep key content in the middle 60% of the height.

## Item turn-ins and player notes

- In edit mode, drop an item on an objective to require it (set the count, and Hand over or Show only), or below the objectives to add one for it.
- Players use **Hand over** / **Show** on the objective, or drag the item from their character sheet onto it. Deposits take only what is still needed; the GM can Undo and return items.
- **Player notes** are edited in place with **Edit notes**, one person at a time; others see who is editing.

## What to check in milestone 2

As GM:
- Empty log shows **Add sample quests**. It creates five quests in a **Quests** journal folder.
- **New quest** creates one, set to Hidden, and opens it for editing.
- Edit name, status, giver, description, objectives, and player notes. Changes save when you leave a field.
- **Done** returns to the read view. **Edit** reopens editing.
- In the read view: status buttons (Reveal, Start, Complete, Fail, Reopen) and clickable objective boxes, no edit mode needed.
- Click an objective's box to cycle open → done → failed.
- Toggle **Focus** and an objective's hide (eye) box.
- Delete a quest. Its subquests stay.

As a player (second browser or user):
- Hidden quests don't appear anywhere, including the journal sidebar.
- Changing a quest from Hidden to Available makes it appear, live.
- Hidden objectives don't show.
- Opening a quest from the journal sidebar shows a summary with **Open in Quest Log**.

Folders and filters:
- The journal folder is named **FHQL Quests** (an older "Quests" folder is renamed on load).
- **New folder** (folder-plus icon) creates a folder inside it. Drag quest rows onto a folder header to move them, or use ⋮ → Move to folder.
- Click a folder header to collapse it; the log remembers.
- Status chips filter the list; the search box filters by name as you type.
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
- Mark a quest **Focus**: its name and all its objectives appear on the Quest Beacon above the players list, on every client that can see it. Clicking opens the log on that quest.
- Mark two quests: a **+1** badge appears, with the other name on hover.
- Configure Settings has per-client toggles for the widget and its objective line.

Rewards and claiming:
- Drop an item or actor onto Rewards. Rewards start locked (lock icon). Click the lock to release one, or mark the quest Completed to release all (setting).
- As a player: **Claim** puts an item on your assigned character (or asks which); **Recruit** gives you access to an actor reward. Dragging an item reward onto your character sheet does the same.
- As GM: **Give** picks a player and character. Claimed items are struck through with "Claimed by…"; the ↺ button undoes a claim and asks before removing the item.
- The eye button on objectives and rewards hides or shows them, in read view too.

FQL import (if the world has Forien's Quest Log data):
- The log shows **Import from FQL (n)**. The preview lists every FQL quest.
- Import, then check: quests appear with objectives, rewards, giver, notes; subquests sit under parents; the report lists any fixes.
- Run it again: already-imported quests are skipped unless you tick Re-import.

Storage test (passed 2026-09-28; re-run after storage changes) (docs/SCOPE.md 5.2): with a quest created, disable the module, restart, check the journal entry still opens, then re-enable and check the quest is intact.

## Dev tooling

The module has no build step. `package.json` exists only for checks.

```sh
npm install
npm run check      # lint + module load + contrast
npm run load       # loads every module file with Foundry mocked; catches bad imports
npm run contrast   # WCAG AA contrast check for every theme token
npm run layout     # renders templates at many widths, fails on text overflow
                   # (set CHROMIUM_PATH to use an installed Chromium)
```

## Layout

| Path | Purpose |
|---|---|
| `module.json` | Manifest |
| `src/main.js` | Entry point: registers settings, keybindings, API |
| `src/compat.js` | The one place version-sensitive Foundry APIs are reached |
| `src/theme.js` | Applies theme classes to open windows |
| `src/apps/` | ApplicationV2 windows |
| `templates/` | Handlebars templates |
| `styles/fhql.css` | Theme tokens and component styles |
| `lang/en.json` | English strings |
| `tools/` | Dev scripts |

## License

MIT. See [LICENSE](LICENSE).

## Releasing

1. Update `CHANGELOG.md`.
2. On GitHub, draft a release with a tag like `v0.3.0` and publish it.
3. The Release workflow runs the checks, stamps the version into `module.json`, and attaches `module.json` and `module.zip` to the release.
