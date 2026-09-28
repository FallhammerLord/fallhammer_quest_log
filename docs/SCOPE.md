# Fallhammer Quest Log: Scope and Guidelines

Status: draft, 2026-09-28. Items marked **[verify]** need checking against current Foundry docs before we build on them.

## 1. Purpose

A quest log module for Foundry VTT that:

- covers the core of Forien's Quest Log (FQL),
- imports existing FQL quests,
- ships light, dark, and sci-fi themes as first-class features,
- survives Foundry major versions with small patches instead of rewrites.

### Why not fork FQL

- FQL's windows use Application v1, which Foundry has deprecated. Removal is expected around v16 **[verify]**. Porting all three windows is close to a UI rewrite.
- The original owner no longer maintains FQL. The v14 compatibility patch is third-party.
- FQL's data format is simple. Import is cheap, so a clean build loses little.

## 2. Goals

1. **Feature parity for the core loop.** GMs create, reveal, and resolve quests. Players read, track, and (when allowed) edit them.
2. **Themes built in.** Light, Dark, Sci-fi. Each passes contrast checks.
3. **FQL migration.** One-click import of FQL quests with nothing lost.
4. **Longevity.** Only public Foundry APIs. Version-specific code lives in one place.
5. **Readability.** Legible fonts by default, status never shown by color alone.

## 3. Non-goals (v1)

- A general journal replacement.
- Two-way sync with FQL. Import is one-way.
- System-specific reward logic (XP math, currency rules).
- Supporting Foundry versions below the minimum we set.

## 4. Scope

### 4.1 v1.0 (must have)

**Quest data**
- Name, image, quest giver (actor, item, or custom name/image)
- Description (rich text, enriched links)
- Objectives with nested subtasks, each with done/failed state
- Rewards: dragged items, actors, or free text; per-reward visibility
- GM notes (GM only), player notes
- Status: hidden, available, active, completed, failed
- Parent/subquest links
- Created/started/ended timestamps
- In Progress marker (party-wide, set by the GM)

**Windows**
- Quest Log: one window, quest list plus detail pane. Tabs by status, search, sort
- Quest Sheet: the detail view, shown inside the log or popped out on its own
- In Progress widget: above the players list (see 7.2)
- Quest Tracker: optional floating panel of active quests

**Entry points and quick actions**
- See section 7

**Permissions**
- Visibility follows Foundry document ownership
- Players may edit when the GM allows it. Player edits route through the GM client

**Themes**
- Light, Dark, Sci-fi
- Per-client setting: Follow Foundry / Light / Dark / Sci-fi

**Migration**
- Detect journal entries with `flags['forien-quest-log'].json`
- Preview, then import. Leave the originals untouched

**Localization**
- Every user-facing string in `lang/en.json`

### 4.2 Later (v1.x)

- `QuestAPI` shim matching FQL's public API for existing macros
- Quest folders or categories
- Chat cards for quest updates
- Custom status sets
- Export/import quests as JSON
- Dedicated Quests tab in the sidebar

### 4.3 Out of scope

- Anything under Non-goals
- Replicating FQL's internal code structure

## 5. Architecture

### 5.1 Target versions

- Minimum: v13. Verified: v14. **[decide]**
- Test against each new major's prerelease builds.

### 5.2 Data storage

Recommended: each quest is a JournalEntry holding one page of a custom module subtype (`fallhammer-quest-log.quest`), declared in `module.json` under `documentTypes` and backed by a `TypeDataModel` **[verify v14 syntax]**.

Why:
- The schema is validated by Foundry itself.
- `migrateData` gives versioned schema migration for free.
- Ownership, compendiums, import/export, and permissions all work natively.

Fallback: a validated JSON flag on JournalEntry, like FQL. It's simpler, but we'd own validation and migration ourselves.

### 5.3 UI

- `ApplicationV2` with `HandlebarsApplicationMixin` for all windows.
- Templates are split into parts so partial re-renders stay cheap.
- Use `DragDrop` and context-menu helpers from core, no custom versions.

### 5.4 Player edits

- Prefer the core query API (`CONFIG.queries` / `User#query`, v13+) for GM-relayed edits **[verify]**. Fall back to `game.socket` only if needed.
- The GM client validates every relayed change against permissions.

### 5.5 Compatibility boundary

- All version-sensitive calls go through `src/compat.js`.
- A new Foundry major should mean editing that file, plus fixing what deprecation warnings flag.

## 6. Theming spec

### 6.1 Structure

- Every window root gets `.fql-app` plus a theme class: `.fql-theme-light`, `.fql-theme-dark`, `.fql-theme-scifi`.
- "Follow Foundry" maps to light or dark based on core's `.theme-light` / `.theme-dark`.
- Styling uses CSS custom properties only. Component CSS never contains raw color values.

### 6.2 Tokens (starting set)

| Token | Role |
|---|---|
| `--fql-surface` | Window background |
| `--fql-surface-raised` | Rows, cards |
| `--fql-surface-sunken` | Inputs, drop zones |
| `--fql-ink` | Body text |
| `--fql-ink-muted` | Secondary text, hidden items |
| `--fql-rule` | Dividers, borders |
| `--fql-hover` | Hover overlay |
| `--fql-accent` | Links, focus, active tab |
| `--fql-status-active` / `-completed` / `-failed` / `-hidden` | Status colors |
| `--fql-font-body` / `--fql-font-heading` | Typefaces |
| `--fql-radius` | Corner shape |
| `--fql-texture` | Optional background image |

### 6.3 Themes

- **Light:** parchment feel, close to FQL.
- **Dark:** candlelit parchment. Texture multiplied over a deep base, warm ink.
- **Sci-fi:** flat dark panels, thin glowing rules, chamfered corners via `clip-path`, a monospace or technical font. Changes shape as well as color.

### 6.4 Accessibility rules

- Text contrast of at least 4.5:1 (WCAG AA) on every surface in every theme.
- Status uses an icon plus a label; color is decoration.
- Decorative fonts only for headings. Body text stays in a legible face.
- Sci-fi motion (glow pulses, scanlines) respects `prefers-reduced-motion`.
- Visible keyboard focus in every theme.

## 7. UX and entry points

### 7.1 Who opens it, and when

- **GM mid-session:** reveal a quest, tick an objective, mark complete. Needs to be fast.
- **GM during prep:** long-form writing and organizing. A big window is fine.
- **Players:** mostly glance at the current goal. Opening the full log is the rare case.

Design rule: most player contact happens without opening the log.

### 7.2 In Progress widget

The primary player-facing surface.

- The GM marks quests **In Progress** from the quest sheet or a right-click menu. The marker is party-wide.
- The widget sits directly above Foundry's players list (lower left).
- It shows the first In Progress quest's name. If more are marked, a badge shows the count ("+2").
- Optional second line: the next unfinished objective the viewer can see, or a progress count ("2/5"). Setting, on by default.
- Clicking opens the Quest Log with that quest selected.
- Only shows quests the viewer can see. The GM sees hidden ones with a hidden marker.
- Long names truncate with an ellipsis; the full name shows on hover.
- Re-renders on every client when the marker or objectives change.
- Uses our theme tokens.

**Fragility rules.** v13 rebuilt the players list and renamed its render hook **[verify v14]**.
- Insert our own element next to the list. Never edit core's markup.
- The hook lives in `src/compat.js`.
- Fail silently: if the hook changes, we lose the widget, not the UI.
- Other entry points stay available when the list is collapsed or hidden by another module.

### 7.3 Other entry points

Each is toggleable by the GM, separately for GMs and players.

1. **Keyboard shortcut** via Foundry's keybinding system, rebindable. Unbound by default, or a combination that clashes with nothing in core **[verify]**.
2. **Scene control button** under Token controls, as a button, not a tool. Opening the log never switches the canvas layer **[verify v14 API]**.
3. **Journal sidebar header icon**, next to the create buttons. Replaces FQL's large footer bar.
4. **Link redirect.** Any link to a quest's journal entry opens our Quest Sheet.
5. **Hotbar drag.** Dragging a quest, or the log, to the hotbar creates a macro backed by our API. No macro compendium.
6. **Hide from players** switch, like FQL's.

### 7.4 Window form

- **One window, list plus detail pane.** Avoids FQL's stack of per-quest windows.
- **Pop-out on demand** for any quest: second monitor, side-by-side comparison.
- **Narrow layout:** below a set width, list and detail stack vertically, so the log works docked beside the sidebar.
- Remember size and position per client.

### 7.5 Quick actions

- Right-click menus on log rows, tracker rows, and the widget: change status, reveal/hide, set In Progress, tick objectives.
- A short notice for players when a quest is revealed or updated.

### 7.6 Keyboard and focus

- Opening a window moves focus into it. Esc closes it.
- Arrow keys move through the quest list.
- Every icon-only button has a tooltip and an accessible label.

### 7.7 What we avoid from FQL

- Footer button that only shows while the journal tab is open.
- Scene control tools that switch the canvas to the Notes layer.
- One window per quest.
- Hard-coded offsets for positioning around the hotbar.

## 8. FQL import

- Source: `JournalEntry.flags['forien-quest-log'].json`.
- Map every field. List unmapped fields in the import report.
- **Import in place.** Add our quest page to the existing journal entry; FQL's flag stays on it. Entry IDs don't change, so every link survives untouched: `@UUID` links in text, links from other journals, scene map pins, macros, quest givers, and rewards.
- **Clicking a quest link opens our sheet.** Any link to a quest's journal entry routes to the Quest Sheet.
- **Parent/child cleanup.** FQL stores the relationship on both sides (child `parent`, parent `subquests[]`), and they can disagree. On import:
  - drop IDs that point at deleted entries,
  - reconcile using the child's `parent` as the truth,
  - list each fix in the import report.
- **Idempotent.** Each imported quest records its FQL source ID. Re-running skips quests already imported, so it never overwrites edits. A per-quest "re-import and overwrite" is available.
- Never deletes or edits the FQL data. Edits made in our module don't flow back to FQL.

### Our parent/child model

Store the relationship once: each quest holds an optional `parent` ID. Subquests are worked out from it at read time. Nothing else to keep in sync.

## 9. Development practices

### 9.1 Foundry API hygiene

- Public, documented APIs only. No `_private` methods.
- No monkey-patching core. If unavoidable, use libWrapper and record why.
- Run with compatibility warnings on during development, and fix every deprecation as soon as it appears.

### 9.2 Code

- Native ES modules, no build step for v1. Revisit if it hurts.
- Plain CSS with native nesting and custom properties. No SCSS.
- JSDoc on public functions.
- ESLint with a shared config.
- Small files with one job each.

### 9.3 Testing

- In-Foundry automated tests with Quench **[verify maintained]** for data model, import, and permissions.
- A manual test checklist per release: each window × each theme × GM/player.
- A fixture world with sample FQL quests for import tests.

### 9.4 Releases

- Semantic versioning.
- GitHub Releases host `module.json` and the zip; the manifest URL points at the latest release.
- Changelog entry per release.
- Update `compatibility.verified` only after running the test checklist on that version.

## 10. Milestones

1. **Skeleton.** Manifest, empty ApplicationV2 windows, theme tokens, theme setting.
2. **Data model.** Quest subtype, create/edit/delete, permissions.
3. **Quest Sheet.** Full editing UI.
4. **Quest Log, In Progress widget, entry points.**
5. **Tracker.**
6. **Player edits.** GM relay.
7. **FQL import.**
8. **Theme polish.** Dark and Sci-fi, contrast audit.
9. **v1.0 release.**

## 11. Open decisions

- Minimum Foundry version (v13 or v14).
- Data storage: page subtype (recommended) or flag.
- Module ID and display name.
- Sci-fi fonts and whether to bundle them.
- Whether the `QuestAPI` shim ships in v1.0 or later.
- In Progress: allow several quests (recommended) or exactly one.
- Whether quest entries show in the journal sidebar for players, or only through our UI.
- Whether the Tracker ships in v1.0, given the In Progress widget covers the glance use.
