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

**Windows**
- Quest Log: tabs by status, search, sort
- Quest Sheet: details, objectives, rewards, notes, management (GM)
- Quest Tracker: floating panel of active quests, pin a primary quest

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

## 7. FQL import

- Source: `JournalEntry.flags['forien-quest-log'].json`.
- Map every field. List unmapped fields in the import report.
- Keep FQL's quest IDs, so parent/subquest links survive.
- Idempotent: running it twice creates no duplicates.
- Never deletes or edits the FQL data.

## 8. Development practices

### 8.1 Foundry API hygiene

- Public, documented APIs only. No `_private` methods.
- No monkey-patching core. If unavoidable, use libWrapper and record why.
- Run with compatibility warnings on during development, and fix every deprecation as soon as it appears.

### 8.2 Code

- Native ES modules, no build step for v1. Revisit if it hurts.
- Plain CSS with native nesting and custom properties. No SCSS.
- JSDoc on public functions.
- ESLint with a shared config.
- Small files with one job each.

### 8.3 Testing

- In-Foundry automated tests with Quench **[verify maintained]** for data model, import, and permissions.
- A manual test checklist per release: each window × each theme × GM/player.
- A fixture world with sample FQL quests for import tests.

### 8.4 Releases

- Semantic versioning.
- GitHub Releases host `module.json` and the zip; the manifest URL points at the latest release.
- Changelog entry per release.
- Update `compatibility.verified` only after running the test checklist on that version.

## 9. Milestones

1. **Skeleton.** Manifest, empty ApplicationV2 windows, theme tokens, theme setting.
2. **Data model.** Quest subtype, create/edit/delete, permissions.
3. **Quest Sheet.** Full editing UI.
4. **Quest Log and Tracker.**
5. **Player edits.** GM relay.
6. **FQL import.**
7. **Theme polish.** Dark and Sci-fi, contrast audit.
8. **v1.0 release.**

## 10. Open decisions

- Minimum Foundry version (v13 or v14).
- Data storage: page subtype (recommended) or flag.
- Module ID and display name.
- Sci-fi fonts and whether to bundle them.
- Whether the `QuestAPI` shim ships in v1.0 or later.
