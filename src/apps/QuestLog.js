import { HandlebarsApp } from '../compat.js';
import { inputPopover } from '../ui/popover.js';
import { MODULE_ID, MODULE_PATH, STATUSES } from '../constants.js';
import { applyTheme, trackApp, untrackApp } from '../theme.js';
import { clampToMinSize } from './minSize.js';
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
import { isUnseen } from '../data/seen.js';

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
         toggleStatusFilter: QuestLog.#onToggleStatusFilter,
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
    */
   onQuestChanged(options, userId)
   {
      if (!this.rendered) { return; }
      const quiet = userId === game.user.id && options?.fhqlQuiet;
      // Someone else's change must not wipe text being written in an open editor here.
      this.render(quiet || this._hasUnsavedEditor() ? { parts: ['list'] } : {});
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

   /** @returns {{ statuses: string[], collapsed: string[] }} This client's saved list filter. */
   static #savedFilter()
   {
      const saved = game.settings.get(MODULE_ID, 'listFilter') ?? {};
      return { statuses: saved.statuses ?? [], collapsed: saved.collapsed ?? [] };
   }

   /** @param {{ statuses: string[], collapsed: string[] }} filter - Filter to save for this client. */
   static #saveFilter(filter)
   {
      game.settings.set(MODULE_ID, 'listFilter', filter);
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
         while (byId.has(questPage(top).system.parent) && !seen.has(top.id))
         {
            seen.add(top.id);
            top = byId.get(questPage(top).system.parent);
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
    * Appends quest rows for one folder, each quest followed by its subquests in the same folder.
    *
    * @param {object[]} rows - Rows to append to.
    * @param {JournalEntry[]} entries - Quests in this folder.
    * @param {number} depth - Indent of top-level quests in this folder.
    * @param {string[]} chain - Folder IDs containing these quests.
    */
   #addQuestRows(rows, entries, depth, chain)
   {
      const tracked = new Set(trackedIds());
      const ids = new Set(entries.map((e) => e.id));
      const childrenOf = new Map();
      const roots = [];
      for (const entry of entries)
      {
         const parent = questPage(entry).system.parent;
         if (parent && ids.has(parent)) { childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), entry]); }
         else { roots.push(entry); }
      }

      const seen = new Set();
      const add = (entry, level) =>
      {
         if (seen.has(entry.id)) { return; }
         seen.add(entry.id);
         const { status, inProgress } = questPage(entry).system;
         rows.push({
            id: entry.id,
            uuid: entry.uuid,
            name: entry.name,
            search: entry.name.toLowerCase(),
            status,
            inProgress,
            tracked: tracked.has(entry.id),
            depth: Math.min(level, 6),
            chain: chain.join(' '),
            statusIcon: STATUSES[status].icon,
            statusLabel: game.i18n.localize(`FHQL.Status.${status}`),
            selected: entry.id === this.#selectedId,
            unseen: entry.id !== this.#selectedId && isUnseen(entry)
         });
         for (const child of childrenOf.get(entry.id) ?? []) { add(child, level + 1); }
      };
      for (const entry of roots) { add(entry, depth); }
   }

   /**
    * Shows or hides list rows for the status chips, search text, and collapsed folders, without a
    * re-render, so typing in the search box keeps focus. While searching, collapsed folders open.
    */
   #applyListFilters()
   {
      const list = this.element?.querySelector('.fhql-list');
      if (!list) { return; }
      const { statuses, collapsed } = QuestLog.#savedFilter();
      const query = this.#query.trim().toLowerCase();
      const collapsedSet = new Set(collapsed);
      const chainOf = (el) => (el.dataset.chain ? el.dataset.chain.split(' ') : []);

      const matchedFolders = new Set();
      let visible = 0;
      for (const row of list.querySelectorAll('[data-row="quest"]'))
      {
         const matches = (!statuses.length || statuses.includes(row.dataset.status))
          && (!query || row.dataset.search.includes(query));
         const chain = chainOf(row);
         if (matches) { chain.forEach((id) => matchedFolders.add(id)); }
         const folded = !query && chain.some((id) => collapsedSet.has(id));
         row.hidden = !matches || folded;
         if (matches) { visible++; }
      }

      const filtering = statuses.length > 0 || !!query;
      for (const row of list.querySelectorAll('[data-row="folder"]'))
      {
         const folded = !query && chainOf(row).some((id) => collapsedSet.has(id));
         row.hidden = folded || (filtering && !matchedFolders.has(row.dataset.folderId));
         const open = !!query || !collapsedSet.has(row.dataset.folderId);
         row.classList.toggle('is-collapsed', !open);
         row.querySelector('[data-action="toggleFolder"]')?.setAttribute('aria-expanded', String(open));
      }

      const empty = list.querySelector('.fhql-no-matches');
      if (empty) { empty.hidden = visible > 0 || !list.querySelector('[data-row="quest"]'); }
   }

   /** @override */
   _onFirstRender(context, options)
   {
      super._onFirstRender(context, options);
      const el = this.element;

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

      // Right-click (or the context-menu key) on a quest row opens the quest menu for that quest.
      el.addEventListener('contextmenu', (event) =>
      {
         const row = event.target.closest?.('[data-row="quest"]');
         if (!row || !game.user.isGM) { return; }
         event.preventDefault();
         const button = row.querySelector('.fhql-row');
         const anchor = event.clientX || event.clientY ? { x: event.clientX, y: event.clientY } : button;
         this._openQuestMenu(getQuestEntry(button?.dataset.questId), anchor);
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
      catch { return; }
      const id = data?.type === 'JournalEntry' ? data.uuid?.split('.').pop() : null;
      const entry = getQuestEntry(id);
      if (entry && zone.dataset.folderDrop !== 'outside') { await moveQuestToFolder(entry, zone.dataset.folderDrop); }
   }

   /** Smallest readable size; the layout reflows down to this. */
   static MIN_SIZE = { width: 420, height: 380 };

   /** @override */
   _updatePosition(position)
   {
      return super._updatePosition(clampToMinSize(position, QuestLog.MIN_SIZE));
   }

   /** @override */
   _onRender(context, options)
   {
      super._onRender(context, options);
      applyTheme(this.element);
      trackApp(this);
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
   static async #onSelectQuest(event, target)
   {
      // Typed but unsaved editor text belongs to the quest being left; save it first.
      await this._flushEdits();
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
      const id = target.closest('[data-folder-id]')?.dataset.folderId;
      if (!id || this.#query.trim()) { return; }
      const filter = QuestLog.#savedFilter();
      filter.collapsed = filter.collapsed.includes(id) ? filter.collapsed.filter((c) => c !== id) : [...filter.collapsed, id];
      QuestLog.#saveFilter(filter);
      const rows = [...this.element.querySelectorAll('.fhql-list-items > li')];
      // A second click mid-slide: drop the running slide, so its end can't re-hide a reopened row.
      for (const row of rows) { if (row.fhqlSlide) { row.fhqlSlide = null; row.getAnimations().forEach((a) => a.cancel()); row.hidden = row.fhqlClosing ?? row.hidden; row.style.overflow = ''; } }
      const before = new Set(rows.filter((row) => !row.hidden));
      this.#applyListFilters();
      QuestLog.#slideRows(rows.filter((row) => before.has(row) && row.hidden), rows.filter((row) => !before.has(row) && !row.hidden));
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
