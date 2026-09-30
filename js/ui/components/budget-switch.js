/**
 * Budget Switcher & Sync Control Component
 */
import { state } from '../../state.js';
import { SyncEngine } from '../../api/sync-engine.js';
import { sqliteEngine } from '../../db/sqlite-wasm.js';
import { ynabClient } from '../../api/ynab-client.js';
import { Toast } from './toast.js';

export const BudgetSwitch = {
  async init() {
    const selectEl = document.getElementById('budget-select');
    const syncBtn = document.getElementById('sync-now-btn');
    const syncStatusIcon = document.getElementById('sync-status-icon');
    const lastSyncEl = document.getElementById('last-sync-time');
    const clearCacheBtn = document.getElementById('clear-cache-btn');

    // Subscribe to syncStatus
    state.subscribe('syncStatus', (status) => {
      if (syncStatusIcon) {
        if (status === 'syncing') {
          syncStatusIcon.classList.add('animate-spin');
        } else {
          syncStatusIcon.classList.remove('animate-spin');
        }
      }
    });

    state.subscribe('lastSyncTime', (time) => {
      if (lastSyncEl) {
        lastSyncEl.textContent = time ? `Synced: ${time}` : 'Not synced yet';
      }
    });

    // Populate budgets
    await this.refreshBudgetList();

    // Budget switch event
    if (selectEl) {
      selectEl.addEventListener('change', async (e) => {
        const newId = e.target.value;
        if (!newId) return;

        state.set('selectedBudgetId', newId);
        Toast.info(`Switching budget...`);
        
        try {
          await sqliteEngine.openDatabase(newId);
          await SyncEngine.syncBudget(newId);
          Toast.success(`Loaded budget successfully`);
          window.dispatchEvent(new CustomEvent('ynab:budget-loaded'));
        } catch (err) {
          Toast.error(`Failed to load budget: ${err.message}`);
        }
      });
    }

    // Sync Now button
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        const budgetId = state.get('selectedBudgetId');
        if (!budgetId) return;

        Toast.info('Syncing budget with YNAB...');
        try {
          await SyncEngine.syncBudget(budgetId, false);
          Toast.success('Sync complete');
          window.dispatchEvent(new CustomEvent('ynab:budget-loaded'));
        } catch (err) {
          Toast.error(`Sync error: ${err.message}`);
        }
      });
    }

    // Clear cache button
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', async () => {
        const budgetId = state.get('selectedBudgetId');
        if (!budgetId) return;

        if (confirm('Clear local SQLite cache for this budget? It will be re-downloaded on next sync.')) {
          try {
            await sqliteEngine.deleteFromIndexedDB(budgetId);
            await sqliteEngine.openDatabase(budgetId);
            await SyncEngine.syncBudget(budgetId, true);
            Toast.success('Local cache cleared and re-synced.');
            window.dispatchEvent(new CustomEvent('ynab:budget-loaded'));
          } catch (err) {
            Toast.error(`Failed to clear cache: ${err.message}`);
          }
        }
      });
    }

    // Custom events
    window.addEventListener('ynab:reload-budgets', () => this.refreshBudgetList());
    window.addEventListener('ynab:mode-changed', () => this.refreshBudgetList());
  },

  async refreshBudgetList() {
    const selectEl = document.getElementById('budget-select');
    if (!selectEl) return;

    selectEl.innerHTML = '';

    const token = state.get('apiToken');
    if (!token) {
      // Check if local database has budgets
      try {
        const localBudgets = (sqliteEngine && sqliteEngine.db) ? sqliteEngine.query('SELECT id, name FROM budgets') : [];
        if (localBudgets && localBudgets.length > 0) {
          for (const b of localBudgets) {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = `${b.name} (Local)`;
            selectEl.appendChild(opt);
          }
          const activeId = state.get('selectedBudgetId') || localBudgets[0].id;
          selectEl.value = activeId;
          return;
        }
      } catch (e) {
        console.warn('Could not query local budgets:', e);
      }

      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No PAT configured (Click Settings)';
      selectEl.appendChild(opt);
      return;
    }

    try {
      const budgets = await ynabClient.getBudgets(token);
      state.set('budgetsList', budgets);

      for (const b of budgets) {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        selectEl.appendChild(opt);
      }

      let activeId = state.get('selectedBudgetId');
      if (!activeId || !budgets.some(b => b.id === activeId)) {
        activeId = budgets[0]?.id || '';
        state.set('selectedBudgetId', activeId);
      }

      selectEl.value = activeId;
    } catch (err) {
      // Fallback to local SQLite budgets
      try {
        const localBudgets = (sqliteEngine && sqliteEngine.db) ? sqliteEngine.query('SELECT id, name FROM budgets') : [];
        if (localBudgets && localBudgets.length > 0) {
          for (const b of localBudgets) {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = `${b.name} (Local)`;
            selectEl.appendChild(opt);
          }
          selectEl.value = state.get('selectedBudgetId') || localBudgets[0].id;
          return;
        }
      } catch (e) {
        // Ignore fallback error
      }

      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Error loading budgets';
      selectEl.appendChild(opt);
    }
  }
};
