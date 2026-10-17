# Fallhammer Quest Log

A quest log for Foundry VTT v14: quests with objectives, rewards and subquests, a Quest Beacon above
the players list, item turn-ins, reward claiming, eight themes, and an importer for Forien's Quest Log.

**Status:** 0.3.0, feature-complete preview. Requires Foundry VTT v14. See [CHANGELOG.md](CHANGELOG.md).

## Install

In Foundry: **Add-on Modules → Install Module**, paste this manifest URL, and install:

```
https://github.com/FallhammerLord/fallhammer_quest_log/releases/latest/download/module.json
```

Then enable **Fallhammer Quest Log** in your world's Manage Modules.

## Quick start

Open the Quest Log from the **Quest Log** button in the Journal tab, the scroll icon in the Token
controls, the Quest Beacon above the players list, a key you bind in Configure Controls, or a macro:
`game.modules.get('fhql').api.openQuestLog()`.

As GM:

- **New quest** creates a hidden quest and opens it for editing. Fields save as you leave them; **Done** returns to the read view.
- Status buttons in the read view: Reveal, Start, Complete, Fail, Reopen. Click an objective's box to cycle open, done, failed.
- Drop an actor on the giver, items or actors on Rewards, a quest on Subquests. Drop an item on an objective to require it.
- Right-click a quest for its menu (pop out, access, move, set parent, delete); right-click a folder to add a subfolder, rename, move or delete it.
- **Show players** opens a quest on players' screens.
- Mark a quest **Party focus** to put it on everyone's Beacon.

As a player:

- Track quests to show them on your Beacon. Hand over or show required items from your character, by button or by dragging from the sheet.
- Claim rewards once the GM releases them. With the GM's settings, accept quests, propose new ones, and edit the shared player notes.

## Themes

Light, Dark (art deco), Sci-fi, Gothic (after Bloodborne), Cabaret, Hope and Fear (after Daggerheart),
Noir (for Blades in the Dark), and Ledger (after Tidy 5e Sheets, following its colors when Tidy is active).
The GM sets the table's theme, texture strength, fonts and theme images; each player can override the
theme, texture strength and fonts for themselves. Theme and font choices preview live in Module Settings.

## Coming from Forien's Quest Log

When a world has Forien's Quest Log data, the Quest Log shows **Import from FQL**. The import works in
place, keeps parent and subquest links, and reports anything it repaired. Running it again skips quests
already imported.

## Accessibility

Every status shows an icon and a label, never color alone. Theme colors meet WCAG AA contrast (checked
by `npm run contrast`). Buttons are at least 24 px, icon-only ones 28 px, each with a label for screen
readers. Everything works by keyboard; quick choices open as panels that close on Esc. Players who ask
their system for reduced motion get plain fades.

## Credits

Fonts bundled under the SIL Open Font License 1.1 (licence beside each font in `styles/fonts/`):

| Font | Theme | By |
|---|---|---|
| IM Fell English SC | Gothic | Igino Marini |
| Josefin Sans | Dark | The Josefin Sans Project Authors |
| Oxanium | Sci-fi | The Oxanium Project Authors (Severin Meyer) |
| Limelight | Cabaret | Sorkin Type Co |
| Cinzel | Hope and Fear | The Cinzel Project Authors (Natanael Gama) |
| Courier Prime | Noir | The Courier Prime Project Authors (Quote-Unquote Apps) |
| Overpass (body text) | Hope and Fear | The Overpass Project Authors (Red Hat) |

Light uses Amiri and Ledger uses Modesto Condensed, both shipped with Foundry. Icons are Font Awesome,
as shipped with Foundry. Theme textures and wash images are drawn for this module
(`tools/make-washes.mjs`). Hope and Fear, Noir and Ledger are styled after Daggerheart, Blades in the
Dark and Tidy 5e Sheets as homage; this module is not affiliated with their makers.

## Development

No build step: plain ES modules, Handlebars templates, CSS. `package.json` exists only for checks.

```sh
npm install
npm run check      # lint, module load with Foundry mocked, theme contrast, deposit and quest rules
npm run layout     # renders the templates at many widths and themes; fails on overflow
                   # (set CHROMIUM_PATH to use an installed Chromium)
```

Install for development by cloning into `<FoundryData>/Data/modules/fhql` (the folder name must match
the module ID). After any change to `module.json`, return to Setup and relaunch the world.

Start with [`CLAUDE.md`](CLAUDE.md) for the code map, conventions and the rules that are easy to break,
and [`docs/SCOPE.md`](docs/SCOPE.md) for the design and its decisions. Manual tests are in
[`docs/TESTING.md`](docs/TESTING.md).

## Releasing

1. Update `CHANGELOG.md`.
2. On GitHub, draft a release with a tag like `v0.3.0` and publish it.
3. The Release workflow runs the checks, stamps the version into `module.json`, and attaches `module.json` and `module.zip` to the release.

## License

MIT. See [LICENSE](LICENSE). Bundled fonts keep their own licence (SIL Open Font License 1.1).
