/**
 * YNAB Intelligence Suite — Core Application Bootstrapper & Router
 */
import { state } from './state.js';
import { sqliteEngine } from './db/sqlite-wasm.js';
import { initSchema } from './db/schema.js';
import { SyncEngine } from './api/sync-engine.js';
import { ynabClient } from './api/ynab-client.js';

import { AuthModal } from './ui/components/auth-modal.js';
import { BudgetSwitch } from './ui/components/budget-switch.js';
import { Toast } from './ui/components/toast.js';

import { ExecutiveView } from './ui/views/executive-view.js';
import { BudgetView } from './ui/views/budget-view.js';
import { CashFlowView } from './ui/views/cashflow-view.js';
import { NetWorthView } from './ui/views/networth-view.js';
import { TransactionView } from './ui/views/transaction-view.js';
import { RecurringView } from './ui/views/recurring-view.js';
import { Queries } from './db/queries.js';

class App {
  constructor() {
    this.contentContainer = null;
    this.navLinks = [];
  }

  async init() {
    console.log('[App] Initializing YNAB Intelligence Suite...');
    this.contentContainer = document.getElementById('view-container');

    // 1. Theme Initialization
    this.initTheme();

    // 2. Auth Modal & Budget Switch Init
    AuthModal.init();
    await BudgetSwitch.init();

    // 3. Navigation setup
    this.initNavigation();

    // 4. Timeframe Selector Setup
    this.initTimeframeSelector();

    // 5. Global Event Listeners
    window.addEventListener('ynab:budget-loaded', () => {
      this.populateTimeframeMonths();
      this.renderCurrentView();
    });
    window.addEventListener('ynab:mode-changed', () => this.bootActiveBudget());

    // 6. Open Settings Buttons (Desktop & Mobile)
    const settingsBtn = document.getElementById('open-settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => AuthModal.open());
    }
    const mobileSettingsBtn = document.getElementById('mobile-settings-btn');
    if (mobileSettingsBtn) {
      mobileSettingsBtn.addEventListener('click', () => AuthModal.open());
    }

    // 6. Boot active budget
    await this.bootActiveBudget();
  }

  initTheme() {
    const applyTheme = (theme) => {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      const icon = document.getElementById('theme-toggle-icon');
      if (icon) {
        icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
        if (window.lucide) window.lucide.createIcons();
      }
    };

    const currentTheme = state.get('theme');
    applyTheme(currentTheme);

    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const nextTheme = state.get('theme') === 'dark' ? 'light' : 'dark';
        state.set('theme', nextTheme);
        applyTheme(nextTheme);
        this.renderCurrentView(); // Re-render charts with new theme colors
      });
    }
  }

  initNavigation() {
    this.navLinks = document.querySelectorAll('.nav-link');
    this.navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const viewName = link.dataset.view;
        if (window.location.hash !== `#${viewName}`) {
          window.location.hash = viewName;
        } else {
          this.switchView(viewName);
        }
      });
    });

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'executive';
      const validViews = ['executive', 'budget', 'cashflow', 'networth', 'transactions', 'recurring'];
      if (validViews.includes(hash)) {
        this.switchView(hash);
      }
    });

    const initialHash = window.location.hash.replace('#', '');
    const validViews = ['executive', 'budget', 'cashflow', 'networth', 'transactions', 'recurring'];
    if (validViews.includes(initialHash)) {
      state.set('currentView', initialHash);
      this.updateNavClasses(initialHash);
    }
  }

  updateNavClasses(viewName) {
    this.navLinks.forEach(link => {
      if (link.dataset.view === viewName) {
        link.classList.add('bg-indigo-500/10', 'text-indigo-600', 'dark:text-indigo-400', 'font-semibold');
        link.classList.remove('text-slate-600', 'dark:text-slate-400');
      } else {
        link.classList.remove('bg-indigo-500/10', 'text-indigo-600', 'dark:text-indigo-400', 'font-semibold');
        link.classList.add('text-slate-600', 'dark:text-slate-400');
      }
    });
  }

  switchView(viewName) {
    state.set('currentView', viewName);
    this.updateNavClasses(viewName);
    this.renderCurrentView();
  }

  initTimeframeSelector() {
    const selectEl = document.getElementById('timeframe-select');
    if (!selectEl) return;

    selectEl.addEventListener('change', (e) => {
      const selected = e.target.value;
      state.set('selectedTimeframe', selected);
      this.renderCurrentView();
    });
  }

  populateTimeframeMonths() {
    const budgetId = state.get('selectedBudgetId');
    const optgroup = document.getElementById('months-optgroup');
    if (!budgetId || !optgroup) return;

    try {
      const months = Queries.getAvailableMonths(budgetId);
      optgroup.innerHTML = '';
      for (const m of months) {
        const opt = document.createElement('option');
        opt.value = m;
        const [year, month] = m.split('-').map(Number);
        const dateObj = new Date(year, month - 1, 1);
        const formatted = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        opt.textContent = `${formatted} (${m})`;
        optgroup.appendChild(opt);
      }
    } catch (e) {
      console.warn('Failed to populate available months:', e);
    }
  }

  renderCurrentView() {
    const viewName = state.get('currentView');
    if (!this.contentContainer) return;

    switch (viewName) {
      case 'executive':
        ExecutiveView.render(this.contentContainer);
        break;
      case 'budget':
        BudgetView.render(this.contentContainer);
        break;
      case 'cashflow':
        CashFlowView.render(this.contentContainer);
        break;
      case 'networth':
        NetWorthView.render(this.contentContainer);
        break;
      case 'transactions':
        TransactionView.render(this.contentContainer);
        break;
      case 'recurring':
        RecurringView.render(this.contentContainer);
        break;
      default:
        ExecutiveView.render(this.contentContainer);
        break;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  renderOnboarding() {
    if (!this.contentContainer) return;
    this.contentContainer.innerHTML = `
      <div class="max-w-2xl mx-auto py-12 px-6 glass-panel rounded-3xl text-center space-y-6 shadow-xl border border-slate-200/80 dark:border-slate-800/80 my-8">
        <div class="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
          <i data-lucide="key" class="w-8 h-8"></i>
        </div>
        <div>
          <h2 class="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Welcome to YNAB Intelligence Suite</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
            High-performance financial analytics powered by your YNAB data, running completely client-side in your browser via SQLite WebAssembly.
          </p>
        </div>
        <div class="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300 max-w-md mx-auto text-left space-y-2">
          <div class="font-semibold flex items-center gap-1.5"><i data-lucide="shield-check" class="w-4 h-4"></i> 100% Private & In-Browser</div>
          <p class="text-slate-600 dark:text-slate-400 leading-normal">Your Personal Access Token and financial records stay exclusively on your device in local SQLite and IndexedDB.</p>
        </div>
        <div class="pt-2">
          <button id="onboarding-connect-btn" class="px-6 py-3 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all inline-flex items-center gap-2">
            <i data-lucide="plug" class="w-4 h-4"></i> Connect YNAB Account
          </button>
        </div>
      </div>
    `;

    const btn = document.getElementById('onboarding-connect-btn');
    if (btn) {
      btn.addEventListener('click', () => AuthModal.open());
    }

    if (window.lucide) window.lucide.createIcons({ root: this.contentContainer });
  }

  async bootActiveBudget() {
    const token = state.get('apiToken');
    if (!token) {
      this.renderOnboarding();
      return;
    }

    let budgetId = state.get('selectedBudgetId');
    if (!budgetId) {
      try {
        const budgets = await ynabClient.getBudgets(token);
        if (budgets && budgets.length > 0) {
          budgetId = budgets[0].id;
          state.set('selectedBudgetId', budgetId);
          state.set('budgetsList', budgets);
        } else {
          Toast.error('No budgets found in your YNAB account.');
          return;
        }
      } catch (err) {
        console.error('Failed to fetch budgets list:', err);
        Toast.error(`Failed to connect to YNAB: ${err.message}`);
        this.renderOnboarding();
        return;
      }
    }

    try {
      // 1. Open or restore SQLite database
      await sqliteEngine.openDatabase(budgetId);
      initSchema(sqliteEngine);
      await BudgetSwitch.refreshBudgetList();

      // 2. Check if initial sync needed
      const checkMeta = sqliteEngine.query('SELECT count(*) as count FROM budgets WHERE id = ?;', [budgetId])[0];
      if (!checkMeta || checkMeta.count === 0) {
        Toast.info('Conducting initial budget sync...');
        await SyncEngine.syncBudget(budgetId, false);
      } else {
        // If budget exists but months table is not yet populated, sync in background
        const monthsCount = sqliteEngine.query('SELECT count(*) as count FROM months WHERE budget_id = ?;', [budgetId])[0]?.count || 0;
        if (monthsCount === 0) {
          SyncEngine.syncBudget(budgetId, false).then(() => {
            this.populateTimeframeMonths();
            this.renderCurrentView();
          }).catch(err => console.warn('Background months sync error:', err));
        }
      }

      this.populateTimeframeMonths();
      this.renderCurrentView();
    } catch (err) {
      console.error('[App] Failed to boot budget:', err);
      Toast.error(`Error loading database: ${err.message}`);
    }
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init().catch(err => {
    console.error('Fatal initialization error:', err);
  });
});
