# Fallhammer Quest Log

A quest log for Foundry VTT v14 with light, dark, and sci-fi themes, and import from Forien's Quest Log.

**Status:** early development (milestone 2, data model). Quests can be created and edited; the editor is basic until milestone 3.

Scope, design, and decisions live in [`docs/SCOPE.md`](docs/SCOPE.md).

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
   - The In Progress quest above the players list (appears once a quest is marked In progress).
   - A key you bind in Configure Controls → Fallhammer Quest Log → Open Quest Log.
   - Macro: `game.modules.get('fhql').api.openQuestLog()`
4. Switch themes in Configure Settings → Fallhammer Quest Log → Quest Log theme.

## What to check in milestone 2

As GM:
- Empty log shows **Add sample quests**. It creates five quests in a **Quests** journal folder.
- **New quest** creates one, set to Hidden, and opens it for editing.
- Edit name, status, giver, description, objectives, and player notes. Changes save when you leave a field.
- **Done** returns to the read view. **Edit** reopens editing.
- In the read view: status buttons (Reveal, Start, Complete, Fail, Reopen) and clickable objective boxes, no edit mode needed.
- Click an objective's box to cycle open → done → failed.
- Toggle **In progress** and an objective's hide (eye) box.
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

Entry points:
- Journal tab shows a **Quest Log** button in its header, for GM and players.
- Token controls show a scroll button; clicking it opens the log and leaves the Token tool active.
- Mark a quest **In progress**: its name and all its objectives appear on the Quest Beacon above the players list, on every client that can see it. Clicking opens the log on that quest.
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
npm run check      # lint + contrast
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
