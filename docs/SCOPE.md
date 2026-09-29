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
- Quest Beacon: above the players list (see 7.2)
- Quest Tracker: optional floating panel of active quests

**Entry points and quick actions**
- See section 7

**Permissions**
- Visibility follows Foundry document ownership, per the map in 5.6
- Players may edit when the GM allows it. Player edits route through the GM client
- Default ownership level for new quests (GM setting)

**Player workflows** (each a GM setting, off by default unless noted)
- Accept an available quest, moving it to active
- Create quests. Needs core "create journal" permission; new quests land in Available with the creator as owner
- Trusted-player editing: trusted owners get status control and fuller editing
- Claim rewards: items go onto the player's character and are struck out; actors (followers, mounts) grant ownership. See 5.10

**Sharing**
- Quests in compendiums and Adventure documents keep parent/child links on import to another world
- Drop a quest onto a scene to create a map pin that opens it

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
- Chat cards for quest updates
- Custom status sets
- Export/import quests as JSON
- Dedicated Quests tab in the sidebar

### 4.3 Out of scope

- Anything under Non-goals
- Replicating FQL's internal code structure
- FQL's navigation-style and bookmark-background settings. Our themes replace them

## 5. Architecture

### 5.1 Target versions

- Minimum: v14. Verified: v14. Decided 2026-09-28.
- Test against each new major's prerelease builds.

### 5.2 Data storage

Recommended: each quest is a JournalEntry holding one page of a custom module subtype (`fhql.quest`), declared in `module.json` under `documentTypes` and backed by a `TypeDataModel` **[verify v14 syntax]**.

Why:
- The schema is validated by Foundry itself.
- `migrateData` gives versioned schema migration for free.
- Ownership, compendiums, import/export, and permissions all work natively.

Fallback: a validated JSON flag on JournalEntry, like FQL. It's simpler, but we'd own validation and migration ourselves.

**When the module is disabled** (researched 2026-09-28)

Findings:
- Foundry's module sub-types article: when a module providing sub-types is deactivated, documents using those sub-types become invalid and disappear from view. Core warns the user before disabling such a module.
- Invalid embedded documents are retained, not deleted. Since v10.277 they are tracked in `invalidDocumentIds` / `getInvalid()`, and the server accepts updates to them.
- v12 fixed a bug where an invalid embedded document made its parent invalid (foundryvtt#10566, closed in V12 testing). On v13+, an invalid quest page should leave its journal entry intact **[confirm on a live v14 world]**.
- Open v14 bug to watch: module updates can leave cached `documentTypes` stale (foundryvtt#14796, v14.369).

What this means for us:
- Disabled module: the quest page vanishes, while the journal entry, its other pages, and FQL's flag stay. Re-enabling restores the page.
- Flags would be no better. Flag data is invisible without the module too.
- A plain-text copy page was considered for readability without the module. **Dropped 2026-09-29:** it would duplicate every quest in the journal while the module runs, and the live test showed re-enabling restores everything.
- Decision: **page subtype**. Core's disable warning is a bonus: it tells GMs what they'll lose.

Live test before milestone 2 (needs a licensed v14 install):
1. Create a quest. Disable the module. Restart the world.
2. Check that the journal entry still opens.
3. Check the Document Issues screen lists the invalid page.
4. Re-enable. Check the quest is fully restored.

### 5.3 UI

- `ApplicationV2` with `HandlebarsApplicationMixin` for all windows.
- Templates are split into parts so partial re-renders stay cheap.
- Use `DragDrop` and context-menu helpers from core, no custom versions.

### 5.4 Player edits

- Prefer the core query API (`CONFIG.queries` / `User#query`, v13+) for GM-relayed edits **[verify]**. Fall back to `game.socket` only if needed.
- The GM client validates every relayed change against permissions and content rules (5.8).

### 5.5 Compatibility boundary

- All version-sensitive calls go through `src/compat.js`.
- A new Foundry major should mean editing that file, plus fixing what deprecation warnings flag.

### 5.6 Permission map (proposed)

| Ownership | Player sees | Player can |
|---|---|---|
| None | Nothing | Nothing |
| Limited | Name, image, giver, status | Nothing |
| Observer | Adds description, visible objectives, visible rewards, player notes | Accept, drag rewards (if enabled) |
| Owner | Same as Observer | Edit description, objectives, player notes (if enabled). Trusted: change status |

Always GM only, whatever the ownership:
- GM notes
- Hidden objectives and hidden rewards
- The FQL source flag

**Hidden status drives ownership** (built in milestone 2). Setting a quest to Hidden sets its default ownership to None, so Foundry itself hides it everywhere: journal sidebar, links, and data sent to players. Revealing it restores the level from the "Player access when a quest is revealed" setting (Limited or Observer, default Observer). GMs can still adjust single players with Foundry's ownership controls.

**GM notes live on a separate page** with player ownership None, never in the quest page's data. Anything on the quest page reaches every player who can see the quest, even when the UI hides it. Hidden objectives and rewards share that limit: the UI hides them, but a player with console access could read them. That matches FQL; moving them off-page is a possible later hardening.

### 5.7 Concurrent edits

- Update single fields, never rewrite the whole quest. FQL rewrote its full JSON blob on every save, so simultaneous edits silently lost one side.
- Objectives and rewards use stable IDs, so two edits to different objectives never collide.
- Where two edits hit the same field, last write wins, and the open sheet re-renders to show it.

### 5.8 Content safety

- Sanitize all rich text from players before storing and before display. FQL used DOMPurify; prefer Foundry's own sanitizer if it covers the same cases **[verify]**.
- The GM relay rejects fields the sender can't edit, and oversized or malformed content.

### 5.9 Scale

- Target: a world with 500 quests stays responsive.
- Build the quest index once, update it from document hooks, and never rescan the world on render.
- Search and tab filtering run on the index, not the DOM.

### 5.10 Reward claiming

Rewards that are Foundry documents can be claimed, not just read. Text rewards stay narrative.

**Reward states**
- **Locked** (default): visible if not hidden, not claimable. Shows a lock icon.
- **Claimable**: GM unlocks per reward, or all at once. World setting: unlock all rewards automatically when a quest is marked Completed (default on).
- **Claimed**: records who and which character. Items are struck through with "Claimed by Rinn (Kestrel)". Actors show "Now with Rinn".

**Claiming an item** (the +1 longsword, a set of potions)
- Player clicks **Claim**, or drags the reward onto their character sheet.
- With one owned character, it goes straight there. With several, a small picker asks which (remembered as the default next time).
- The item is copied onto the character with its quantity intact. The world item is untouched, so the same reward can be restocked.
- Players often can't read the source item, so the copy runs on the GM's client through the query API (`CONFIG.queries['fhql.claimReward']`, called with `game.users.activeGM.query(...)`, confirmed in v14 types). The GM client re-checks: quest visible to the player, reward claimable and unclaimed, target character owned by the player.
- No GM online: the Claim button explains that a GM must be connected.

**Claiming an actor** (an NPC follower, a mount)
- Player clicks **Claim**; the GM client gives that player Owner on the actor (world setting for the level: Owner by default, Observer as the alternative).
- Optional world setting: also place the actor in a "Followers" folder. Off by default.

**Per-reward options (GM, edit mode)**
- **Claims allowed:** once (default), or once per player (each player gets a copy; for "everyone gets a healing potion").
- **Hidden** and **Locked** toggles, as now.

**Creature comforts**
- A chat card for each claim: "Rinn claimed +1 Longsword for Kestrel", with the item's image.
- A short notice on the claimer's screen when it lands.
- GM **Undo claim** on any claimed reward. It clears the claim mark; it asks before also deleting the copied item from the character, and never deletes silently.
- Claimed and claimable counts on the Rewards heading ("2 of 3 claimed").
- The Quest Beacon shows a gift icon when the In Progress quest has claimable rewards, so players notice without opening the log.
- Keyboard: Claim is a real button; the character picker is a keyboard-navigable list.

**As built (2026-09-29):** Claim / Recruit for players (straight onto the assigned character, or a picker), Give for GMs (player and character picker), lock/unlock and eye toggles in the read view, per-reward "once / each player" in edit mode, strike-through and "Claimed by…" with GM Undo, "n of m claimed" on the heading, drag onto a character sheet claims through the same path (`dropActorSheetData`), chat card, Beacon gift icon, auto-unlock on Completed, and a setting for the access actor rewards grant. `locked` is kept rather than renamed to `claimable`.

Known limit: the v14 query API doesn't tell the GM client which user sent a request, so a player could in principle claim on another player's behalf. The GM side still checks visibility, lock state, claim limits, and character ownership against the named player.

**Data added to each reward:** `claimable` (replaces `locked`), `claimLimit` ('once' | 'perPlayer'), `claims` (list of { userId, actorUuid, itemUuid, at }).

## 6. Theming spec

### 6.1 Structure

- Every window root gets `.fhql-app` plus a theme class: `.fhql-theme-auto`, `.fhql-theme-light`, `.fhql-theme-dark`, `.fhql-theme-scifi`.
- `auto` (Follow Foundry) maps to light or dark from core's `.theme-light` / `.theme-dark` classes, in CSS alone.
- Prefix is `fhql-`, never `fql-`. FQL already uses `.fql-app` and `--fql-*` variables, and both modules run side by side during migration.
- Styling uses CSS custom properties only. Component CSS never contains raw color values.

### 6.2 Tokens (starting set)

| Token | Role |
|---|---|
| `--fhql-surface` | Window background |
| `--fhql-surface-raised` | Rows, cards |
| `--fhql-surface-sunken` | Inputs, drop zones |
| `--fhql-ink` | Body text |
| `--fhql-ink-muted` | Secondary text, hidden items |
| `--fhql-rule` | Dividers, borders |
| `--fhql-hover` | Hover overlay |
| `--fhql-accent` | Links, focus, active tab |
| `--fhql-status-active` / `-completed` / `-failed` / `-hidden` | Status colors |
| `--fhql-font-body` / `--fhql-font-heading` | Typefaces |
| `--fhql-radius` | Corner shape |
| `--fhql-texture` | Optional background image |

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

### 7.2 Quest Beacon

Named 2026-09-29. The panel above the players list showing the In Progress quest and all its objectives.

The primary player-facing surface.

- The GM marks quests **In Progress** from the quest sheet or a right-click menu. The marker is party-wide.
- The widget sits directly above Foundry's players list (lower left).
- It shows the first In Progress quest's name. If more are marked, a badge shows the count ("+2").
- Lists every objective the viewer can see, with done/failed/open icons; hidden ones only for the GM. The list scrolls past 40% of screen height. Setting to hide the list, on by default.
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

### 7.3a Quest list organization (built 2026-09-29)

- **Folders are Foundry journal folders** inside the root **FHQL Quests** folder (found by flag, so renaming is safe). Create, rename, color, and sort them in the journal sidebar or with the log's New folder button.
- The list shows top-level quests first, then collapsible folder headers with counts. Subquests indent under parents within a folder. Players only see folders holding quests they can see.
- Quests moved outside FHQL Quests appear in an "Outside FHQL Quests" group.
- **Status filter chips** (icon-only, labeled for screen readers) and a **search box** filter the list without re-rendering. While searching, collapsed folders open.
- Filters and collapsed folders are remembered per client.
- GMs drag quest rows onto folder headers to move them, or use ⋮ → Move to folder. Rows drag as normal journal entries, so they also drop onto the hotbar or canvas.

### 7.4 Window form

- **One window, list plus detail pane.** Avoids FQL's stack of per-quest windows.
- **Pop-out on demand** for any quest: second monitor, side-by-side comparison.
- **Narrow layout:** below a set width, list and detail stack vertically, so the log works docked beside the sidebar.
- Remember size and position per client.

### 7.4a Responsive rules (2026-09-29)

**Minimum window sizes** (enforced in `_updatePosition`): Quest Log 420×380, pop-out Quest Sheet 340×320, FQL import 440×380.

**How layouts compress,** widest to narrowest:

| Width | What changes |
|---|---|
| Log below 540px | Quest list stacks above the sheet |
| Sheet below 560px | Two columns become one, ordered by use in play |
| Sheet below 460px | Status, In progress, and Edit buttons go icon-only |
| Sheet below 400px | Smaller portrait; details line moves under the title |
| Reward list below 340px (and always in edit mode) | Reward controls move under the reward name |
| Reward list below 230px | Reward buttons go icon-only |
| Subquest list below 230px | Subquest status text hides |
| Sheet below 400px | Section heading buttons go icon-only |

**Rules every component follows**
- Components respond to their own width (container queries), not the screen's. Width containers go only on elements with no text fields or editors inside: Foundry's own form and editor styles break when a nearby ancestor is a container (found in testing, 2026-09-29).
- Text wraps between words; a long unbroken word breaks only when it would overflow. Nothing is clipped except list rows and the Beacon, which truncate with an ellipsis and show the full name on hover.
- A button that drops its text keeps its icon, a tooltip, and a screen-reader label.
- Icon buttons stay at least 24px square (WCAG 2.2 target size).
- One primary (filled) button per region: Done in edit mode, Claim for players.
- `npm run layout` renders every template at each breakpoint with stress data (long names, unbroken words, every reward state) and fails on any overflow. Run it before each release and after any layout change.

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

### As built (2026-09-29)

- **Where:** GM button "Import from FQL (n)" in the log whenever un-imported FQL quests exist, or `game.modules.get('fhql').api.openFqlImport()`.
- **Preview:** a table of every FQL quest with status, objective and reward counts, and New / Re-import per row.
- **Field map:** status (inactive → Hidden), description, player notes, GM notes (to the GM-only page), tasks → objectives (done/failed/hidden kept), rewards (Item/Actor links kept, Abstract → text; hidden and locked kept), giver (document link or custom name and image), splash → quest image, dates, FQL's primary quest → In Progress. Location, priority, and type have no equivalent and are listed in the report when set.
- **Folder move (option, on by default):** moves imported quests to FHQL Quests › Imported from FQL. FQL only reads its hidden `_fql_quests` folder, so a re-enabled FQL won't see moved quests. Unticked, quests stay put and show under Outside FHQL Quests.
- **Hidden quests** get player access removed, so our hiding rule holds. Reported per quest.
- **Never replaces** a quest page it didn't create.
- **Report:** counts plus every fix and note, per quest.

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
- `npm run layout`: automated overflow check across widths, modes, and viewers (7.4a).
- A fixture world with sample FQL quests for import tests.

### 9.4 Releases

- Semantic versioning.
- GitHub Releases host `module.json` and the zip; the manifest URL points at the latest release.
- Changelog entry per release.
- Update `compatibility.verified` only after running the test checklist on that version.

### 9.5 Module compatibility

Test and document behavior with:
- Monk's Enhanced Journal (FQL shipped special handling for it)
- PopOut! (pop-out windows)
- UI-hiding modules (they affect the Quest Beacon)
- Carolingian UI and Classic UI (restyle the players list; found in testing that the list's contents overflow its box)

### 9.6 Documentation and distribution

- README with screenshots of each theme
- User guide: GM setup, player use, FQL import
- Issue templates for bugs and feature requests
- Listing on the Foundry package directory

### 9.7 License and naming

- FQL is MIT licensed. Reused code, icons, or fonts keep FQL's copyright notice in our LICENSE or a NOTICE file.
- Our name and branding avoid "Forien", so users don't mistake us for the official module.

## 10. Definition of done (v1.0)

- Imports a real FQL world with nothing lost, and the import report lists every fix.
- Every window passes the contrast check (6.4) in all three themes.
- `npm run layout` reports no overflow.
- Runs on the verified Foundry version with no deprecation warnings.
- The manual test checklist passes for each window × theme × GM/player.
- Disabling and re-enabling the module loses nothing.
- A 500-quest world stays responsive.

## 11. Milestones

1. **Skeleton.** Manifest, empty ApplicationV2 windows, theme tokens, theme setting. *Done, verified on v14.*
2. **Data model.** Quest subtype, create/edit/delete, permissions. *Built 2026-09-28.*
3. **Quest Sheet.** Full editing UI: rich text editor, giver and reward drag-drop, GM notes page, subquests. *Built 2026-09-28 from the approved mockup. Plain-text page dropped.*
4. **Quest Log, Quest Beacon, entry points.** *Built 2026-09-28/29: log with folders, filters, search; Beacon; journal button, token control, keybinding. To do: sort options, per-entry-point GM toggles, hide-from-players switch, link redirect straight to the Quest Sheet.*
5. **Tracker.** *Likely dropped: the Quest Beacon covers it (open decision).*
6. **Player workflows.** GM relay, accept, create, reward dragging. *Reward claiming built 2026-09-29. To do: accept, create, trusted-player editing, GM toggles.*
7. **FQL import.** *Built 2026-09-29; awaiting a test on real FQL data.*
8. **Sharing.** Compendiums, Adventures, map pins.
9. **Theme polish.** Dark and Sci-fi, contrast audit.
10. **Docs and release prep.** Checked against section 10.
11. **v1.0 release.**

## 12. Decided

- Module ID `fhql`, display name "Fallhammer Quest Log", CSS prefix `fhql-`.
- Minimum and verified Foundry version: v14.
- Data storage: page subtype `fhql.quest` (5.2). Live test passed on v14, 2026-09-28. No plain-text copy page.
- License: MIT.
- In Progress: several quests allowed; the Beacon shows the first with a +N badge.
- Give offers each player's assigned character only; claim mistakes are fixed with Undo.

## 13. Open decisions

- Confirm the permission map (5.6).
- Sci-fi fonts and whether to bundle them.
- Whether the `QuestAPI` shim ships in v1.0 or later.
- Whether quest entries show in the journal sidebar for players, or only through our UI.
- Whether the Tracker ships in v1.0, given the Quest Beacon covers the glance use.
