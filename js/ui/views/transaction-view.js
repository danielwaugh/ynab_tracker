/**
 * Transaction Intelligence & Filter Hub View
 */
import { Queries } from '../../db/queries.js';
import { FinancialMath } from '../../services/financial-math.js';
import { state } from '../../state.js';
import { sqliteEngine } from '../../db/sqlite-wasm.js';

export const TransactionView = {
  // Local view filter state
  filterState: {
    search: '',
    accountId: '',
    categoryId: '',
    type: 'all', // 'all' | 'inflow' | 'outflow'
    timeframe: 'all',
    sortBy: 'date',
    sortDir: 'desc',
    page: 1,
    pageSize: 25
  },

  render(container) {
    const budgetId = state.get('selectedBudgetId');
    if (!budgetId) {
      container.innerHTML = `<div class="p-8 text-center text-slate-500">No budget selected. Please configure API Token in Settings.</div>`;
      return;
    }

    // Default timeframe from global state if set
    const globalTimeframe = state.get('selectedTimeframe');
    if (globalTimeframe && this.filterState.timeframe === 'all' && globalTimeframe !== 'current') {
      this.filterState.timeframe = globalTimeframe;
    }

    // Accounts for dropdown
    const accounts = sqliteEngine.query(
      'SELECT id, name, type FROM accounts WHERE budget_id = ? AND closed = 0 AND deleted = 0 ORDER BY name ASC;',
      [budgetId]
    );

    // Categories for dropdown
    const categories = Queries.getAllActiveCategories(budgetId);

    // Initial query
    const result = Queries.getTransactionExplorer(budgetId, this.filterState);

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header & Action Row -->
        <div class="glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <i data-lucide="receipt" class="w-5 h-5 text-indigo-500"></i>
              Transaction Intelligence Hub
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Search, filter, and inspect detailed ledger records across accounts, payees, and categories with zero server lag.
            </p>
          </div>

          <div class="flex items-center gap-2 self-start md:self-auto">
            <button id="export-csv-btn" class="px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-colors shadow-sm">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
              <span>Export CSV</span>
            </button>
            <button id="reset-filters-btn" class="px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors">
              Reset
            </button>
          </div>
        </div>

        <!-- Filter Controls Panel -->
        <div class="glass-panel p-4 sm:p-6 rounded-2xl space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <!-- Text Search -->
            <div>
              <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Search Memo / Payee</label>
              <div class="relative">
                <i data-lucide="search" class="w-4 h-4 absolute left-3 top-2.5 text-slate-400"></i>
                <input id="tx-search-input" type="text" placeholder="e.g. Trader Joe's, Gas..." value="${this.filterState.search}" class="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              </div>
            </div>

            <!-- Account Filter -->
            <div>
              <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Account</label>
              <select id="tx-account-select" class="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">All Accounts</option>
                ${accounts.map(a => `<option value="${a.id}" ${this.filterState.accountId === a.id ? 'selected' : ''}>${a.name} (${a.type})</option>`).join('')}
              </select>
            </div>

            <!-- Category Filter -->
            <div>
              <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
              <select id="tx-category-select" class="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">All Categories</option>
                ${categories.map(c => `<option value="${c.id}" ${this.filterState.categoryId === c.id ? 'selected' : ''}>${c.group_name} → ${c.name}</option>`).join('')}
              </select>
            </div>

            <!-- Timeframe Filter -->
            <div>
              <label class="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Date Range</label>
              <select id="tx-timeframe-select" class="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="all" ${this.filterState.timeframe === 'all' ? 'selected' : ''}>All History</option>
                <option value="current" ${this.filterState.timeframe === 'current' ? 'selected' : ''}>Current Month</option>
                <option value="last_month" ${this.filterState.timeframe === 'last_month' ? 'selected' : ''}>Last Month</option>
                <option value="last_3m" ${this.filterState.timeframe === 'last_3m' ? 'selected' : ''}>Last 3 Months</option>
                <option value="last_6m" ${this.filterState.timeframe === 'last_6m' ? 'selected' : ''}>Last 6 Months</option>
                <option value="last_12m" ${this.filterState.timeframe === 'last_12m' ? 'selected' : ''}>Last 12 Months</option>
                <option value="ytd" ${this.filterState.timeframe === 'ytd' ? 'selected' : ''}>Year to Date (YTD)</option>
              </select>
            </div>
          </div>

          <!-- Type Radio Pills (All, Outflow, Inflow) -->
          <div class="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <span class="text-xs font-semibold text-slate-500 mr-2">Type:</span>
            <button data-type="all" class="tx-type-btn px-3 py-1 rounded-lg text-xs font-semibold ${this.filterState.type === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}">All</button>
            <button data-type="outflow" class="tx-type-btn px-3 py-1 rounded-lg text-xs font-semibold ${this.filterState.type === 'outflow' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}">Outflows</button>
            <button data-type="inflow" class="tx-type-btn px-3 py-1 rounded-lg text-xs font-semibold ${this.filterState.type === 'inflow' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}">Inflows</button>
          </div>
        </div>

        <!-- Filtered Telemetry Summary Bar -->
        <div id="tx-summary-bar" class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="glass-panel p-4 rounded-2xl">
            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Filtered Records</span>
            <span class="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1 block">${result.totalCount.toLocaleString()}</span>
          </div>
          <div class="glass-panel p-4 rounded-2xl">
            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Inflows</span>
            <span class="text-xl font-bold text-emerald-500 mt-1 block">${FinancialMath.formatCurrency(result.totalInflow)}</span>
          </div>
          <div class="glass-panel p-4 rounded-2xl">
            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Outflows</span>
            <span class="text-xl font-bold text-rose-500 mt-1 block">${FinancialMath.formatCurrency(result.totalOutflow)}</span>
          </div>
          <div class="glass-panel p-4 rounded-2xl">
            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Net Period Movement</span>
            <span class="text-xl font-bold ${result.net >= 0 ? 'text-emerald-500' : 'text-rose-500'} mt-1 block">${FinancialMath.formatCurrency(result.net)}</span>
          </div>
        </div>

        <!-- Data Table Container -->
        <div class="glass-panel rounded-2xl overflow-hidden shadow-sm">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider select-none">
                <tr>
                  <th class="py-3 px-4 cursor-pointer hover:text-indigo-500 sort-th" data-sort="date">
                    <div class="flex items-center gap-1">
                      <span>Date</span>
                      <i data-lucide="${this.getSortIcon('date')}" class="w-3.5 h-3.5"></i>
                    </div>
                  </th>
                  <th class="py-3 px-4 cursor-pointer hover:text-indigo-500 sort-th" data-sort="payee">
                    <div class="flex items-center gap-1">
                      <span>Payee / Merchant</span>
                      <i data-lucide="${this.getSortIcon('payee')}" class="w-3.5 h-3.5"></i>
                    </div>
                  </th>
                  <th class="py-3 px-4 cursor-pointer hover:text-indigo-500 sort-th" data-sort="category">
                    <div class="flex items-center gap-1">
                      <span>Category</span>
                      <i data-lucide="${this.getSortIcon('category')}" class="w-3.5 h-3.5"></i>
                    </div>
                  </th>
                  <th class="py-3 px-4 cursor-pointer hover:text-indigo-500 sort-th" data-sort="account">
                    <div class="flex items-center gap-1">
                      <span>Account</span>
                      <i data-lucide="${this.getSortIcon('account')}" class="w-3.5 h-3.5"></i>
                    </div>
                  </th>
                  <th class="py-3 px-4">Memo</th>
                  <th class="py-3 px-4 text-center">Status</th>
                  <th class="py-3 px-4 text-right cursor-pointer hover:text-indigo-500 sort-th" data-sort="amount">
                    <div class="flex items-center justify-end gap-1">
                      <span>Amount</span>
                      <i data-lucide="${this.getSortIcon('amount')}" class="w-3.5 h-3.5"></i>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody id="tx-table-body" class="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                ${this.renderRows(result.rows)}
              </tbody>
            </table>
          </div>

          <!-- Pagination Bar -->
          <div class="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div class="text-slate-500">
              Showing <span class="font-bold text-slate-800 dark:text-slate-200">${result.rows.length === 0 ? 0 : (result.page - 1) * result.pageSize + 1}</span> to <span class="font-bold text-slate-800 dark:text-slate-200">${Math.min(result.totalCount, result.page * result.pageSize)}</span> of <span class="font-bold text-slate-800 dark:text-slate-200">${result.totalCount.toLocaleString()}</span> entries
            </div>

            <div class="flex items-center gap-2">
              <button id="prev-page-btn" ${result.page <= 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium">
                Previous
              </button>
              <span class="px-2 py-1 font-semibold text-slate-700 dark:text-slate-300">
                Page ${result.page} / ${result.totalPages}
              </span>
              <button id="next-page-btn" ${result.page >= result.totalPages ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium">
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container, budgetId);
    if (window.lucide) window.lucide.createIcons({ root: container });
  },

  getSortIcon(col) {
    if (this.filterState.sortBy !== col) return 'arrow-up-down';
    return this.filterState.sortDir === 'asc' ? 'arrow-up' : 'arrow-down';
  },

  renderRows(rows) {
    if (rows.length === 0) {
      return `
        <tr>
          <td colspan="7" class="py-12 text-center text-slate-400 font-sans">
            No transactions match the selected filters.
          </td>
        </tr>
      `;
    }

    return rows.map(t => {
      const isPositive = t.amount > 0;
      const isTransfer = t.transfer_account_id != null;
      const clearedIcon = t.cleared === 'cleared' ? 'check' : t.cleared === 'reconciled' ? 'lock' : 'circle';
      const clearedColor = t.cleared === 'reconciled' ? 'text-emerald-500' : t.cleared === 'cleared' ? 'text-sky-500' : 'text-slate-400';

      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
          <td class="py-2.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">${t.date}</td>
          <td class="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100 font-sans max-w-[200px] truncate" title="${t.payee_name}">
            ${t.payee_name}
          </td>
          <td class="py-2.5 px-4 font-sans whitespace-nowrap">
            <span class="px-2 py-0.5 rounded-full text-[11px] font-medium ${isTransfer ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}">
              ${t.category_name}
            </span>
          </td>
          <td class="py-2.5 px-4 font-sans text-slate-500 whitespace-nowrap">
            ${t.account_name}
          </td>
          <td class="py-2.5 px-4 font-sans text-slate-400 max-w-[150px] truncate" title="${t.memo || ''}">
            ${t.memo || '—'}
          </td>
          <td class="py-2.5 px-4 text-center">
            <span title="${t.cleared}">
              <i data-lucide="${clearedIcon}" class="w-3.5 h-3.5 inline ${clearedColor}"></i>
            </span>
          </td>
          <td class="py-2.5 px-4 text-right font-bold whitespace-nowrap ${isPositive ? 'text-emerald-500' : 'text-slate-900 dark:text-slate-100'}">
            ${isPositive ? '+' : ''}${FinancialMath.formatCurrency(t.amount)}
          </td>
        </tr>
      `;
    }).join('');
  },

  bindEvents(container, budgetId) {
    const searchInput = container.querySelector('#tx-search-input');
    const accountSelect = container.querySelector('#tx-account-select');
    const categorySelect = container.querySelector('#tx-category-select');
    const timeframeSelect = container.querySelector('#tx-timeframe-select');
    const resetBtn = container.querySelector('#reset-filters-btn');
    const exportCsvBtn = container.querySelector('#export-csv-btn');
    const prevBtn = container.querySelector('#prev-page-btn');
    const nextBtn = container.querySelector('#next-page-btn');

    let debounceTimer = null;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.filterState.search = e.target.value;
          this.filterState.page = 1;
          this.render(container);
        }, 250);
      });
    }

    if (accountSelect) {
      accountSelect.addEventListener('change', (e) => {
        this.filterState.accountId = e.target.value;
        this.filterState.page = 1;
        this.render(container);
      });
    }

    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => {
        this.filterState.categoryId = e.target.value;
        this.filterState.page = 1;
        this.render(container);
      });
    }

    if (timeframeSelect) {
      timeframeSelect.addEventListener('change', (e) => {
        this.filterState.timeframe = e.target.value;
        this.filterState.page = 1;
        this.render(container);
      });
    }

    const typeBtns = container.querySelectorAll('.tx-type-btn');
    typeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.filterState.type = btn.dataset.type;
        this.filterState.page = 1;
        this.render(container);
      });
    });

    const sortHeaders = container.querySelectorAll('.sort-th');
    sortHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (this.filterState.sortBy === col) {
          this.filterState.sortDir = this.filterState.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.filterState.sortBy = col;
          this.filterState.sortDir = 'desc';
        }
        this.render(container);
      });
    });

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.filterState.page > 1) {
          this.filterState.page--;
          this.render(container);
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.filterState.page++;
        this.render(container);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.filterState = {
          search: '',
          accountId: '',
          categoryId: '',
          type: 'all',
          timeframe: 'all',
          sortBy: 'date',
          sortDir: 'desc',
          page: 1,
          pageSize: 25
        };
        this.render(container);
      });
    }

    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        this.exportFilteredCsv(budgetId);
      });
    }
  },

  exportFilteredCsv(budgetId) {
    // Fetch all rows matching current filters (up to 10,000)
    const exportResult = Queries.getTransactionExplorer(budgetId, {
      ...this.filterState,
      page: 1,
      pageSize: 10000
    });

    const headers = ['Date', 'Payee', 'Category', 'Account', 'Memo', 'Cleared', 'Amount (USD)'];
    const csvRows = [headers.join(',')];

    for (const r of exportResult.rows) {
      const escape = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
      csvRows.push([
        escape(r.date),
        escape(r.payee_name),
        escape(r.category_name),
        escape(r.account_name),
        escape(r.memo),
        escape(r.cleared),
        (r.amount / 1000.0).toFixed(2)
      ].join(','));
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvRows.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `ynab_transactions_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
