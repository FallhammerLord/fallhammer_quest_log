import { HandlebarsApp } from '../compat.js';
import { inputPopover } from '../ui/popover.js';
import { openFolderMenu } from './folderMenu.js';
import { ancestorsOf, foldedIds, questRows } from './listTree.js';
import { addListSplitter } from './listSplitter.js';
import { addTipsButton, onShowTips } from './tips.js';
import { MODULE_ID, MODULE_PATH, STATUSES } from '../constants.js';
import { applyTheme, trackApp, untrackApp } from '../theme.js';
import { clampToMinSize, snapWidth } from './minSize.js';
import { scanFqlQuests } from '../import/fql.js';
import { trackedIds } from '../data/tracking.js';
import { canProposeQuests, requestPlayerAction } from '../data/playerActions.js';
import {
   createQuest, createQuestFolder, createSampleQuests, getQuestEntry, moveQuestToFolder, questPage, questRootFolder,
   questSubfolders, visibleQuests
} from '../data/quests.js';
import { QuestSheetMixin } from './QuestSheetMixin.js';
import { stopEditingNotes } from './sheet/notes.js';
import { guardActions } from './sheet/rows.js';
import { getSetting, setSetting } from '../setting.js';

/** How long a family's pips take to fill or drain (ms): the last pip's 120ms delay plus its 80ms fade, as in list.css. */
const PIP_MS = 200;

/** The Quest Log window: quest list plus a quest sheet in the detail pane. Singleton. */
export class QuestLog extends QuestSheetMixin(HandlebarsApp)
{
   /** @type {QuestLog} */
   static #instance;

   /** @returns {QuestLog} The shared Quest Log window. */
   static get instance() { return QuestLog.#instance ??= new QuestLog(); }

   static DEFAULT_OPTIONS = {
      id: 'fhql-quest-log',
      classes: ['fhql-app', 'fhql-quest-log'],
      window: {
         title: 'FHQL.QuestLog.Title',
         icon: 'fa-solid fa-scroll',
         resizable: true
      },
      position: { width: 1040, height: 680 },
      actions: guardActions({
         selectQuest: QuestLog.#onSelectQuest,
         createQuest: QuestLog.#onCreateQuest,
         createSamples: QuestLog.#onCreateSamples,
         createFolder: QuestLog.#onCreateFolder,
         toggleFolder: QuestLog.#onToggleFolder,
         toggleFamily: QuestLog.#onToggleFamily,
         foldAllFamilies: QuestLog.#onFoldAllFamilies,
         showTips: onShowTips,
         toggleStatusFilter: QuestLog.#onToggleStatusFilter,
         clearFilters: QuestLog.#onClearFilters,
         openFqlImport: QuestLog.#onOpenFqlImport
      })
   };

   /** Remembers each player's last size and place. */
   static MEMORY_KEY = 'questLog';

   static PARTS = {
      list: { template: `${MODULE_PATH}/templates/quest-log-list.hbs`, scrollable: [''] },
      detail: { template: `${MODULE_PATH}/templates/quest-sheet.hbs`, scrollable: [''] }
   };

   /** ID of the selected quest's JournalEntry. */
   #selectedId = null;

   /** Current search text. Not persisted. */
   #query = '';

   /** @override */
   get questId() { return this.#selectedId; }

   /**
    * Selects a quest. Used by the API to open the log on a given quest.
    *
    * @param {string} id - JournalEntry ID.
    */
   select(id)
   {
      if (id !== this.#selectedId)
      {
         this._editing = false;
         this._showAllObjectives = false;
         stopEditingNotes(this);
      }
      this.#selectedId = id;
      this.#reveal(id);
   }

   /** @override */
   showQuest(id, { edit = false } = {})
   {
      this.select(id);
      if (edit) { this._editing = true; }
      this.render();
   }

   /**
    * Re-renders after a quest document changes anywhere.
    *
    * @param {object} options - The document operation options.
    * @param {string} userId - The user who made the change.
    * @param {Set<string>|null} [changed] - Changed quests and their parents; null redraws the sheet too.
    */
   onQuestChanged(options, userId, changed = null)
   {
      if (!this.rendered) { return; }
      const quiet = userId === game.user.id && options?.fhqlQuiet;
      // Someone else's change must not wipe text being written in an open editor here, and a change to
      // another quest only touches the list.
      const elsewhere = changed && !changed.has(this.#selectedId) && !changed.has(questPage(this.questEntry)?.system.parentQuest);
      this.render(quiet || elsewhere || this._hasUnsavedEditor() ? { parts: ['list'] } : {});
   }

   /** @override */
   async _prepareContext(options)
   {
      const context = await super._prepareContext(options);
      const entries = visibleQuests();

      if (!entries.some((entry) => entry.id === this.#selectedId)) { this.#selectedId = entries[0]?.id ?? null; }

      const filter = QuestLog.#savedFilter();
      const present = new Set(entries.map((e) => questPage(e).system.status));
      const statusChips = Object.keys(STATUSES).filter((s) => present.has(s)).map((status) => ({
         status,
         icon: STATUSES[status].icon,
         label: game.i18n.localize(`FHQL.Status.${status}`),
         active: filter.statuses.includes(status)
      }));

      return {
         ...context,
         gm: game.user.isGM,
         canPropose: canProposeQuests(),
         hasQuests: entries.length > 0,
         items: this.#listItems(entries, filter),
         statusChips,
         query: this.#query,
         fqlPending: game.user.isGM ? scanFqlQuests().filter((q) => !q.imported).length : 0,
         sheet: await this._prepareSheet(this.questEntry)
      };
   }

   /**
    * @returns {{ statuses: string[], collapsed: string[], expanded: string[] }} This client's saved list
    *   state: status filter, folded folders and quest families, and finished families opened by hand.
    */
   static #savedFilter()
   {
      const saved = getSetting('listFilter') ?? {};
      return { statuses: saved.statuses ?? [], collapsed: saved.collapsed ?? [], expanded: saved.expanded ?? [] };
   }

   /** @param {{ statuses: string[], collapsed: string[], expanded: string[] }} filter - List state to save for this client. */
   static #saveFilter(filter)
   {
      setSetting('listFilter', filter);
   }

   /**
    * Flattens quests and folders into list rows: top-level quests, then each folder header followed by
    * its quests (subquests indented under parents) and subfolders. Quests moved outside the FHQL Quests
    * folder appear in a final group. Collapse and filtering are applied in the DOM (#applyListFilters).
    *
    * @param {JournalEntry[]} entries - Visible quests, already sorted.
    * @param {{ collapsed: string[] }} filter - Saved filter state.
    * @returns {object[]} Rows.
    */
   #listItems(entries, filter)
   {
      const gm = game.user.isGM;
      const root = questRootFolder();
      const subfolders = questSubfolders();
      const folderIds = new Set(subfolders.map((f) => f.id));

      const groupOf = (entry) =>
      {
         const id = entry.folder?.id;
         if (id && folderIds.has(id)) { return id; }
         if (root && id === root.id) { return 'top'; }
         return 'outside';
      };
      // A subquest shows under its parent wherever it is stored (older quests may sit in another folder),
      // so each quest is grouped by its top visible ancestor's folder.
      const byId = new Map(entries.map((e) => [e.id, e]));
      const topOf = (entry) =>
      {
         const seen = new Set();
         let top = entry;
         while (byId.has(questPage(top).system.parentQuest) && !seen.has(top.id))
         {
            seen.add(top.id);
            top = byId.get(questPage(top).system.parentQuest);
         }
         return top;
      };
      const groups = new Map();
      for (const entry of entries)
      {
         const key = groupOf(topOf(entry));
         groups.set(key, [...(groups.get(key) ?? []), entry]);
      }

      const childFolders = (parentId) => subfolders
       .filter((f) => f.folder?.id === parentId)
       .sort((a, b) => (a.folder?.sorting === 'm' ? a.sort - b.sort : 0) || a.name.localeCompare(b.name));

      const countIn = (folderId) => (groups.get(folderId)?.length ?? 0)
       + childFolders(folderId).reduce((sum, f) => sum + countIn(f.id), 0);

      const rows = [];
      const addFolder = (folder, depth, chain) =>
      {
         const count = countIn(folder.id);
         if (!gm && !count) { return; }
         rows.push({
            folder: true, id: folder.id, name: folder.name, color: folder.color?.css ?? folder.color ?? '',
            depth, chain: chain.join(' '), count, collapsed: filter.collapsed.includes(folder.id)
         });
         const inner = [...chain, folder.id];
         this.#addQuestRows(rows, groups.get(folder.id) ?? [], depth + 1, inner);
         for (const child of childFolders(folder.id)) { addFolder(child, depth + 1, inner); }
      };

      this.#addQuestRows(rows, groups.get('top') ?? [], 0, []);
      for (const folder of childFolders(root?.id)) { addFolder(folder, 0, []); }

      const outside = groups.get('outside') ?? [];
      if (outside.length)
      {
         rows.push({
            folder: true, outside: true, id: 'outside', name: game.i18n.localize('FHQL.Folders.Outside'),
            depth: 0, chain: '', count: outside.length, collapsed: filter.collapsed.includes('outside')
         });
         this.#addQuestRows(rows, outside, 1, ['outside']);
      }
      return rows;
   }

   /**
    * Appends quest rows for one folder, each quest followed by its subquests (src/apps/listTree.js).
    *
    * @param {object[]} rows - Rows to append to.
    * @param {JournalEntry[]} entries - Quests in this folder.
    * @param {number} depth - Indent of top-level quests in this folder.
    * @param {string[]} chain - Folder IDs containing these quests.
    */
   #addQuestRows(rows, entries, depth, chain)
   {
      rows.push(...questRows(entries, {
         depth, chain, selectedId: this.#selectedId, tracked: new Set(trackedIds()), activeFirst: getSetting('listActiveFirst')
      }));
   }

   /**
    * Shows or hides list rows for the status chips, search text, and folded folders and quest
    * families, without a re-render, so typing in the search box keeps focus. While searching, folded
    * folders and families open. A parent that doesn't match the filter still shows, dimmed, above a
    * subquest that does, so the subquest keeps its context.
    */
   #applyListFilters()
   {
      const list = this.element?.querySelector('.fhql-list');
      if (!list) { return; }
      const filter = QuestLog.#savedFilter();
      const { statuses } = filter;
      const query = this.#query.trim().toLowerCase();
      const folded = foldedIds(list, filter, getSetting('listFoldFinished'));
      const chainOf = (el) => (el.dataset.chain ? el.dataset.chain.split(' ') : []);
      const quests = [...list.querySelectorAll('[data-row="quest"]')];

      const matching = new Set();
      const holdsMatch = new Set();
      for (const row of quests)
      {
         const matches = (!statuses.length || statuses.includes(row.dataset.status)) && (!query || row.dataset.search.includes(query));
         if (!matches) { continue; }
         matching.add(row);
         chainOf(row).forEach((id) => holdsMatch.add(id));
      }

      let visible = 0;
      for (const row of quests)
      {
         const shown = matching.has(row) || holdsMatch.has(row.dataset.id);
         const hiddenByFold = !query && chainOf(row).some((id) => folded.has(id));
         row.hidden = !shown || hiddenByFold;
         row.classList.toggle('is-context', shown && !matching.has(row));
         if (matching.has(row)) { visible++; }
         if (row.dataset.family === undefined) { continue; }
         const open = !!query || !folded.has(row.dataset.id);
         row.classList.toggle('is-folded', !open);
         row.querySelector('[data-action="toggleFamily"]')?.setAttribute('aria-expanded', String(open));
      }

      const filtering = statuses.length > 0 || !!query;
      for (const row of list.querySelectorAll('[data-row="folder"]'))
      {
         const hiddenByFold = !query && chainOf(row).some((id) => folded.has(id));
         row.hidden = hiddenByFold || (filtering && !holdsMatch.has(row.dataset.folderId));
         const open = !!query || !folded.has(row.dataset.folderId);
         row.classList.toggle('is-collapsed', !open);
         row.querySelector('[data-action="toggleFolder"]')?.setAttribute('aria-expanded', String(open));
      }

      // The toolbar's fold-all button folds every family while any is open, else opens them all.
      const families = quests.filter((row) => row.dataset.family !== undefined);
      const allButton = list.querySelector('[data-action="foldAllFamilies"]');
      if (allButton)
      {
         allButton.hidden = !families.length;
         const anyOpen = families.some((row) => !folded.has(row.dataset.id));
         const label = game.i18n.localize(anyOpen ? 'FHQL.Family.FoldAll' : 'FHQL.Family.UnfoldAll');
         allButton.dataset.fold = String(anyOpen);
         allButton.setAttribute('aria-label', label);
         allButton.dataset.tooltip = label;
         allButton.querySelector('i')?.setAttribute('class', `fa-solid ${anyOpen ? 'fa-compress' : 'fa-expand'}`);
      }

      // "Showing 3 of 12 · Clear" while a filter or search hides quests.
      const status = list.querySelector('.fhql-filter-status');
      if (status)
      {
         status.hidden = !filtering;
         status.querySelector('[data-filter-count]').textContent = game.i18n.format('FHQL.Filter.Showing', { shown: visible, total: quests.length });
      }

      const empty = list.querySelector('.fhql-no-matches');
      if (empty) { empty.hidden = visible > 0 || !list.querySelector('[data-row="quest"]'); }
   }

   /**
    * Folds or opens folders and quest families, sliding the rows that change.
    *
    * @param {string[]} ids - Folder or quest IDs.
    * @param {boolean} fold - Fold them (true) or open them (false).
    */
   #setFolded(ids, fold)
   {
      const filter = QuestLog.#savedFilter();
      const set = new Set(ids);
      filter.collapsed = fold ? [...new Set([...filter.collapsed, ...ids])] : filter.collapsed.filter((id) => !set.has(id));
      // Opening a finished family by hand is remembered, so "fold finished families" leaves it open.
      filter.expanded = fold ? filter.expanded.filter((id) => !set.has(id)) : [...new Set([...filter.expanded, ...ids])];
      QuestLog.#saveFilter(filter);
      const rows = [...this.element.querySelectorAll('.fhql-list-items > li')];
      // A second click mid-slide: drop the running slide, so its end can't re-hide a reopened row.
      for (const row of rows) { if (row.fhqlSlide) { row.fhqlSlide = null; row.getAnimations().forEach((a) => a.cancel()); row.hidden = row.fhqlClosing ?? row.hidden; row.style.overflow = ''; } }
      const before = new Set(rows.filter((row) => !row.hidden));
      // The toggled families' pips fill or drain in step with the slide (styles/components/list.css).
      const toggled = rows.filter((row) => set.has(row.dataset.id) && row.dataset.family !== undefined);
      toggled.forEach((row) => { clearTimeout(row.fhqlPipTimer); row.classList.add('is-animating'); });
      this.#applyListFilters();
      QuestLog.#slideRows(rows.filter((row) => before.has(row) && row.hidden), rows.filter((row) => !before.has(row) && !row.hidden));
      toggled.forEach((row) => { row.fhqlPipTimer = setTimeout(() => row.classList.remove('is-animating'), PIP_MS); });
   }

   /** @param {HTMLElement} row - A family's row. @returns {boolean} Whether it is folded now. */
   #isFolded(row)
   {
      return row.classList.contains('is-folded') || row.classList.contains('is-collapsed');
   }

   /**
    * Opens the folders and parent quests above a quest, so it shows in the list when opened from the
    * Beacon, a link, or Show players. Writes only when something was folded.
    *
    * @param {string} id - The quest's JournalEntry ID.
    */
   #reveal(id)
   {
      const entry = getQuestEntry(id);
      if (!entry) { return; }
      const { folders, quests } = ancestorsOf(entry, getQuestEntry);
      const filter = QuestLog.#savedFilter();
      const ids = [...folders, ...quests];
      const foldFinished = getSetting('listFoldFinished');
      if (ids.some((x) => filter.collapsed.includes(x)) || (foldFinished && quests.some((x) => !filter.expanded.includes(x))))
      {
         filter.collapsed = filter.collapsed.filter((x) => !ids.includes(x));
         if (foldFinished) { filter.expanded = [...new Set([...filter.expanded, ...quests])]; }
         QuestLog.#saveFilter(filter);
      }
   }

   /** @override */
   _onFirstRender(context, options)
   {
      super._onFirstRender(context, options);
      const el = this.element;
      addListSplitter(this);

      // Arrow keys, Home, and End move through visible quest and folder rows.
      el.addEventListener('keydown', (event) =>
      {
         const move = { ArrowDown: 1, ArrowUp: -1 }[event.key];
         const edge = event.key === 'Home' || event.key === 'End';
         if (!move && !edge) { return; }
         const current = event.target.closest?.('.fhql-list-items .fhql-row, .fhql-list-items .fhql-folder');
         if (!current) { return; }
         const rows = [...el.querySelectorAll('.fhql-list-items .fhql-row, .fhql-list-items .fhql-folder')]
          .filter((row) => !row.closest('[hidden]'));
         const index = rows.indexOf(current);
         const next = edge ? rows[event.key === 'Home' ? 0 : rows.length - 1] : rows[index + move];
         if (!next) { return; }
         event.preventDefault();
         next.focus();
      });

      // Right opens a folded folder or quest family (or steps into it); Left folds it (or steps out to its parent).
      el.addEventListener('keydown', (event) =>
      {
         if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') { return; }
         const button = event.target.closest?.('.fhql-list-items .fhql-row, .fhql-list-items .fhql-folder');
         const row = button?.closest('li');
         if (!row || this.#query.trim()) { return; }
         const family = row.dataset.family !== undefined || row.dataset.row === 'folder';
         const folded = this.#isFolded(row);
         const id = row.dataset.id ?? row.dataset.folderId;
         event.preventDefault();
         if (event.key === 'ArrowRight' && family && folded) { this.#setFolded([id], false); return; }
         if (event.key === 'ArrowLeft' && family && !folded) { this.#setFolded([id], true); return; }
         if (event.key === 'ArrowRight' && family)
         {
            const next = row.nextElementSibling;
            if (next && !next.hidden && next.dataset.chain?.split(' ').includes(id)) { next.querySelector('.fhql-row, .fhql-folder')?.focus(); }
            return;
         }
         if (event.key === 'ArrowLeft')
         {
            const up = row.dataset.parentId || row.dataset.chain?.split(' ').filter(Boolean).at(-1);
            const target = up && this.element.querySelector(`[data-row="quest"][data-id="${CSS.escape(up)}"] .fhql-row, [data-folder-id="${CSS.escape(up)}"] .fhql-folder`);
            target?.focus();
         }
      });

      // Esc in a search box with text clears it first; Foundry's own Esc then leaves the box, then closes.
      el.addEventListener('keydown', (event) =>
      {
         if (event.key !== 'Escape' || !event.target.matches?.('[data-list-search]') || !event.target.value) { return; }
         event.preventDefault();
         event.stopPropagation();
         event.target.value = '';
         this.#query = '';
         this.#applyListFilters();
      });

      el.addEventListener('input', (event) =>
      {
         if (!event.target.matches('[data-list-search]')) { return; }
         this.#query = event.target.value;
         this.#applyListFilters();
      });

      // Quest rows drag as ordinary journal entries, so they also work on the hotbar and canvas.
      el.addEventListener('dragstart', (event) =>
      {
         const row = event.target.closest?.('[data-row="quest"]');
         if (!row) { return; }
         event.dataTransfer.setData('text/plain', JSON.stringify({ type: 'JournalEntry', uuid: row.dataset.uuid }));
      });
      el.addEventListener('dragover', (event) =>
      {
         const zone = game.user.isGM && event.target.closest?.('[data-folder-drop]');
         if (!zone) { return; }
         event.preventDefault();
         el.querySelectorAll('.is-drop-target').forEach((z) => z !== zone && z.classList.remove('is-drop-target'));
         zone.classList.add('is-drop-target');
      });
      el.addEventListener('dragleave', (event) => event.target.closest?.('[data-folder-drop]')?.classList.remove('is-drop-target'));
      el.addEventListener('drop', (event) => this.#onFolderDrop(event));

      // Right-click (or the context-menu key) on a quest row opens the quest menu; on a folder, the folder menu.
      el.addEventListener('contextmenu', (event) =>
      {
         if (!game.user.isGM) { return; }
         const row = event.target.closest?.('[data-row="quest"]');
         const folderRow = event.target.closest?.('[data-row="folder"]');
         const folder = game.folders.get(folderRow?.dataset.folderId);
         if (!row && !folder) { return; }
         event.preventDefault();
         const button = (row ?? folderRow).querySelector(row ? '.fhql-row' : '.fhql-folder');
         const anchor = event.clientX || event.clientY ? { x: event.clientX, y: event.clientY } : button;
         if (row) { this._openQuestMenu(getQuestEntry(button?.dataset.questId), anchor); }
         else { openFolderMenu(this, folder, anchor); }
      });
   }

   /** @param {DragEvent} event - A quest row dropped on a folder header or the list. */
   async #onFolderDrop(event)
   {
      const zone = game.user.isGM && event.target.closest?.('[data-folder-drop]');
      if (!zone) { return; }
      event.preventDefault();
      zone.classList.remove('is-drop-target');
      let data;
      try { data = JSON.parse(event.dataTransfer.getData('text/plain')); }
      catch { return; } // Not our drag (plain text from elsewhere): nothing to move.
      const id = data?.type === 'JournalEntry' ? data.uuid?.split('.').pop() : null;
      const entry = getQuestEntry(id);
      if (entry && zone.dataset.folderDrop !== 'outside') { await moveQuestToFolder(entry, zone.dataset.folderDrop); }
   }

   /** Smallest readable size; the layout reflows down to this. */
   static MIN_SIZE = { width: 420, height: 380 };

   /**
    * Comfort widths (see snapWidth). The list takes about 252px; the sheet beside it turns two-column
    * at 560px (styles/components/sheet.css, fhql-sheet container). 560: list beside a one-column sheet, just past
    * the stacked layout (540). 830: the first roomy two-column width. 1040: the default.
    */
   static SNAP_WIDTHS = [560, 830, 1040];

   /** @override */
   _updatePosition(position)
   {
      return super._updatePosition(clampToMinSize(snapWidth(position, QuestLog.SNAP_WIDTHS), QuestLog.MIN_SIZE));
   }

   /** @override */
   _onRender(context, options)
   {
      super._onRender(context, options);
      applyTheme(this.element);
      trackApp(this);
      addTipsButton(this);
      this.#applyListFilters();
   }

   /** The log settles back toward the Beacon when it closes. @override */
   _closeToward() { return document.getElementById('fhql-beacon'); }

   /** @override */
   _onClose(options)
   {
      super._onClose(options);
      untrackApp(this);
   }

   /** @this {QuestLog} */
   /** Increases with each quest click, so only the latest click wins after an editor save. */
   #selectToken = 0;

   /** @this {QuestLog} */
   static async #onSelectQuest(event, target)
   {
      const token = ++this.#selectToken;
      // Typed but unsaved editor text belongs to the quest being left; save it first.
      await this._flushEdits();
      // Another quest was clicked while saving: that later click decides.
      if (token !== this.#selectToken) { return; }
      this.showQuest(target.dataset.questId);
   }

   /** @this {QuestLog} */
   static async #onCreateQuest()
   {
      if (!game.user.isGM)
      {
         const result = await requestPlayerAction({ action: 'create' });
         if (!result.ok) { return; }
         this.select(result.id);
         this._editing = true;
         this.render();
         return;
      }
      const entry = await createQuest();
      this.select(entry.id);
      this._editing = true;
      this.render();
   }

   /** @this {QuestLog} */
   static async #onCreateFolder(event, target)
   {
      const name = await inputPopover(this, target, {
         label: game.i18n.localize('FHQL.Folders.Name'),
         value: game.i18n.localize('FHQL.Folders.NewName'),
         ok: game.i18n.localize('FHQL.Folders.Create')
      });
      if (name) { await createQuestFolder(name); }
   }

   /** @this {QuestLog} */
   static #onToggleFolder(event, target)
   {
      const row = target.closest('[data-folder-id]');
      if (!row || this.#query.trim()) { return; }
      this.#setFolded([row.dataset.folderId], !this.#isFolded(row));
   }

   /**
    * The arrow beside a parent quest folds or opens its subquests. Alt-click does the same for every
    * family inside it too.
    *
    * @this {QuestLog}
    */
   static #onToggleFamily(event, target)
   {
      const row = target.closest('[data-row="quest"]');
      if (!row || this.#query.trim()) { return; }
      const fold = !this.#isFolded(row);
      const ids = [row.dataset.id];
      if (event.altKey)
      {
         for (const inner of this.element.querySelectorAll('[data-row="quest"][data-family]'))
         {
            if (inner.dataset.chain.split(' ').includes(row.dataset.id)) { ids.push(inner.dataset.id); }
         }
      }
      this.#setFolded(ids, fold);
   }

   /** @this {QuestLog} */
   static #onFoldAllFamilies(event, target)
   {
      const ids = [...this.element.querySelectorAll('[data-row="quest"][data-family]')].map((row) => row.dataset.id);
      this.#setFolded(ids, target.dataset.fold === 'true');
   }

   /**
    * Slides folder contents shut or open instead of snapping (about 180ms). Rows being hidden are shown
    * again just long enough to fold away. Reduced motion snaps.
    *
    * @param {HTMLElement[]} closing - Rows that just became hidden.
    * @param {HTMLElement[]} opening - Rows that just became visible.
    */
   static #slideRows(closing, opening)
   {
      if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { return; }
      const timing = { duration: 180, easing: 'cubic-bezier(.2,.7,.2,1)' };
      const slide = (row, keyframes, closingRow) =>
      {
         const token = Symbol('slide');
         row.fhqlSlide = token;
         row.fhqlClosing = closingRow;
         row.style.overflow = 'hidden';
         row.animate(keyframes, timing).finished.then(() =>
         {
            if (row.fhqlSlide !== token) { return; }
            row.fhqlSlide = null;
            row.hidden = closingRow;
            row.style.overflow = '';
         }, () => {});
      };
      for (const row of opening) { slide(row, [{ height: '0px', opacity: 0 }, { height: `${row.offsetHeight}px`, opacity: 1 }], false); }
      for (const row of closing)
      {
         row.hidden = false;
         slide(row, [{ height: `${row.offsetHeight}px`, opacity: 1 }, { height: '0px', opacity: 0 }], true);
      }
   }

   /** @this {QuestLog} */
   static #onToggleStatusFilter(event, target)
   {
      const status = target.dataset.status;
      const filter = QuestLog.#savedFilter();
      filter.statuses = filter.statuses.includes(status) ? filter.statuses.filter((s) => s !== status) : [...filter.statuses, status];
      QuestLog.#saveFilter(filter);
      target.setAttribute('aria-pressed', String(filter.statuses.includes(status)));
      target.classList.toggle('is-on', filter.statuses.includes(status));
      this.#applyListFilters();
   }

   /** Clears the status chips and the search text. @this {QuestLog} */
   static #onClearFilters()
   {
      const filter = QuestLog.#savedFilter();
      filter.statuses = [];
      QuestLog.#saveFilter(filter);
      this.#query = '';
      const list = this.element.querySelector('.fhql-list');
      const search = list?.querySelector('[data-list-search]');
      if (search) { search.value = ''; }
      for (const chip of list?.querySelectorAll('[data-action="toggleStatusFilter"]') ?? [])
      {
         chip.setAttribute('aria-pressed', 'false');
         chip.classList.remove('is-on');
      }
      this.#applyListFilters();
      search?.focus();
   }

   /** @this {QuestLog} */
   static #onOpenFqlImport()
   {
      game.modules.get(MODULE_ID).api.openFqlImport();
   }

   /** @this {QuestLog} */
   static async #onCreateSamples()
   {
      await createSampleQuests();
      this.render();
   }
}
