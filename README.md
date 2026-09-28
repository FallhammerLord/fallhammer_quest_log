# Fallhammer Quest Log

A quest log for Foundry VTT v14 with light, dark, and sci-fi themes, and import from Forien's Quest Log.

**Status:** early development (milestone 1, skeleton). Not ready for play. The Quest Log shows preview data only.

Scope, design, and decisions live in [`docs/SCOPE.md`](docs/SCOPE.md).

## Try it (development)

1. Clone this repo into your Foundry data folder as `Data/modules/fhql`. The folder name must match the module ID.
   ```sh
   cd <FoundryData>/Data/modules
   git clone https://github.com/FallhammerLord/fallhammer_quest_log.git fhql
   ```
2. Restart Foundry, open a world, and enable **Fallhammer Quest Log** in Manage Modules.
3. Open the Quest Log:
   - Macro: `game.modules.get('fhql').api.openQuestLog()`
   - Or bind a key in Configure Controls → Fallhammer Quest Log → Open Quest Log.
4. Switch themes in Configure Settings → Fallhammer Quest Log → Quest Log theme.

## What to check in milestone 1

- The window opens, resizes, and closes without console errors.
- Each theme (Follow Foundry, Light, Dark, Sci-fi) restyles the open window without reopening it.
- Follow Foundry matches your core light/dark interface setting.
- Narrowing the window below ~520px stacks the list above the detail.
- Clicking a quest selects it. Tab and Enter work too.

## Dev tooling

The module has no build step. `package.json` exists only for checks.

```sh
npm install
npm run check      # lint + contrast
npm run contrast   # WCAG AA contrast check for every theme token
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
