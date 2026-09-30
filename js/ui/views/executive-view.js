/**
 * Executive Overview View (Home)
 */
import { Queries } from '../../db/queries.js';
import { FinancialMath } from '../../services/financial-math.js';
import { ChartFactory } from '../../charts/chart-factory.js';
import { state } from '../../state.js';

export const ExecutiveView = {
  render(container) {
    const budgetId = state.get('selectedBudgetId');
    if (!budgetId) {
      container.innerHTML = `<div class="p-8 text-center text-slate-500">No budget selected. Please configure API Token in Settings.</div>`;
      return;
    }

    const timeframe = state.get('selectedTimeframe') || 'current';
    const metrics = Queries.getExecutiveMetrics(budgetId, timeframe);
    const burnData = Queries.getRollingBurnRate(budgetId);
    const runway = FinancialMath.calculateRunway(metrics.liquidCash, burnData.burn3M);

    // Prioritize official YNAB Age of Money from months table
    const ageOfMoneyDays = metrics.ageOfMoneyDays > 0 
      ? metrics.ageOfMoneyDays 
      : Math.min(180, Math.round(metrics.liquidCash / Math.max(1, (burnData.burn3M / 30))));

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Top Metric KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <!-- Net Worth -->
          <div class="glass-panel p-4 rounded-2xl flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Total Net Worth</span>
              <i data-lucide="line-chart" class="w-4 h-4 text-sky-500"></i>
            </div>
            <div class="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              ${FinancialMath.formatCurrency(metrics.netWorth)}
            </div>
            <div class="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <span>Assets:</span>
              <span class="font-medium text-emerald-500">${FinancialMath.formatCompactCurrency(metrics.totalAssets)}</span>
            </div>
          </div>

          <!-- Liquid Cash -->
          <div class="glass-panel p-4 rounded-2xl flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Liquid Cash</span>
              <i data-lucide="wallet" class="w-4 h-4 text-emerald-500"></i>
            </div>
            <div class="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              ${FinancialMath.formatCurrency(metrics.liquidCash)}
            </div>
            <div class="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <span>Runway:</span>
              <span class="font-medium text-emerald-500">${runway.formatted}</span>
            </div>
          </div>

          <!-- Age of Money -->
          <div class="glass-panel p-4 rounded-2xl flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Age of Money</span>
              <i data-lucide="hourglass" class="w-4 h-4 text-amber-500"></i>
            </div>
            <div class="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              ${ageOfMoneyDays} <span class="text-sm font-normal text-slate-500">days</span>
            </div>
            <div class="mt-1 flex items-center gap-1 text-xs">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold ${ageOfMoneyDays >= 30 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}">
                ${ageOfMoneyDays >= 30 ? 'Rule 4 Achieved' : 'Building Buffer'}
              </span>
            </div>
          </div>

          <!-- Monthly Cash Flow -->
          <div class="glass-panel p-4 rounded-2xl flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Net Cash Flow</span>
              <i data-lucide="arrow-left-right" class="w-4 h-4 text-indigo-500"></i>
            </div>
            <div class="mt-2 text-2xl font-bold tracking-tight ${metrics.currentMonth.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}">
              ${FinancialMath.formatCurrency(metrics.currentMonth.net)}
            </div>
            <div class="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>In: ${FinancialMath.formatCompactCurrency(metrics.currentMonth.income)}</span>
              <span>Out: ${FinancialMath.formatCompactCurrency(metrics.currentMonth.expense)}</span>
            </div>
          </div>

          <!-- Savings Rate -->
          <div class="glass-panel p-4 rounded-2xl flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Savings Rate</span>
              <i data-lucide="percent" class="w-4 h-4 text-cyan-500"></i>
            </div>
            <div class="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              ${metrics.currentMonth.savingsRate}%
            </div>
            <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              ${metrics.timeframeLabel}
            </div>
          </div>

          <!-- Ready to Assign -->
          <div class="glass-panel p-4 rounded-2xl flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Ready to Assign</span>
              <i data-lucide="check-circle" class="w-4 h-4 text-violet-500"></i>
            </div>
            <div class="mt-2 text-2xl font-bold tracking-tight ${metrics.readyToAssign === 0 ? 'text-emerald-500' : 'text-amber-500'}">
              ${FinancialMath.formatCurrency(metrics.readyToAssign)}
            </div>
            <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              ${metrics.readyToAssign === 0 ? 'Zero-based perfection' : 'Available to allocate'}
            </div>
          </div>
        </div>

        <!-- Burn Rate & Runway Section -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Burn Gauge Card -->
          <div class="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">Monthly Burn & Pacing</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">Current month outflows vs 3-month rolling average</p>
              </div>
              <span class="px-2 py-1 rounded text-xs font-medium bg-indigo-500/10 text-indigo-500">Live</span>
            </div>
            <div id="burn-gauge-chart" class="h-56 w-full my-2"></div>
            <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-center text-xs">
              <div>
                <span class="text-slate-400 block">3M Avg Burn</span>
                <span class="font-semibold text-slate-800 dark:text-slate-200">${FinancialMath.formatCurrency(burnData.burn3M)}</span>
              </div>
              <div>
                <span class="text-slate-400 block">6M Avg Burn</span>
                <span class="font-semibold text-slate-800 dark:text-slate-200">${FinancialMath.formatCurrency(burnData.burn6M)}</span>
              </div>
              <div>
                <span class="text-slate-400 block">12M Avg Burn</span>
                <span class="font-semibold text-slate-800 dark:text-slate-200">${FinancialMath.formatCurrency(burnData.burn12M)}</span>
              </div>
            </div>
          </div>

          <!-- Runway Calculator -->
          <div class="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between">
                <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">Financial Runway</h3>
                <i data-lucide="shield-check" class="w-5 h-5 text-emerald-500"></i>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Months liquid cash can sustain baseline living without income.</p>
              
              <div class="mt-6 flex items-baseline gap-2">
                <span class="text-4xl font-extrabold text-emerald-500">${runway.months}</span>
                <span class="text-lg text-slate-500 font-medium">Months of Runway</span>
              </div>

              <div class="mt-4 space-y-2 text-xs">
                <div class="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span class="text-slate-500">Available Liquid Funds:</span>
                  <span class="font-semibold text-slate-800 dark:text-slate-200">${FinancialMath.formatCurrency(metrics.liquidCash)}</span>
                </div>
                <div class="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span class="text-slate-500">Baseline Monthly Outflows (3M):</span>
                  <span class="font-semibold text-slate-800 dark:text-slate-200">${FinancialMath.formatCurrency(burnData.burn3M)}</span>
                </div>
                <div class="flex justify-between py-1.5">
                  <span class="text-slate-500">6-Month Emergency Target:</span>
                  <span class="font-semibold text-slate-800 dark:text-slate-200">${FinancialMath.formatCurrency(burnData.burn3M * 6)}</span>
                </div>
              </div>
            </div>

            <div class="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <i data-lucide="check" class="w-4 h-4 shrink-0"></i>
              <span>Your liquid reserves exceed the recommended 3-6 month safety threshold!</span>
            </div>
          </div>

          <!-- Quick Alerts & Action Center -->
          <div class="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between">
                <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">Quick Alerts</h3>
                <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${metrics.alerts.overspent.length > 0 || metrics.alerts.unapprovedCount > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}">
                  ${metrics.alerts.overspent.length + (metrics.alerts.unapprovedCount > 0 ? 1 : 0) + (metrics.alerts.unreconciledAccounts.length > 0 ? 1 : 0)} Issues
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Items requiring your attention</p>

              <div class="mt-4 space-y-3">
                <!-- Overspent Alert -->
                ${metrics.alerts.overspent.length > 0 ? `
                  <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
                    <div class="flex items-center justify-between font-semibold text-rose-600 dark:text-rose-400">
                      <span class="flex items-center gap-1.5"><i data-lucide="alert-circle" class="w-4 h-4"></i> Overspent Categories</span>
                      <span>${metrics.alerts.overspent.length}</span>
                    </div>
                    <div class="mt-1 text-slate-600 dark:text-slate-300">
                      ${metrics.alerts.overspent.map(c => `<b>${c.name}</b> (${FinancialMath.formatCurrency(c.balance)})`).join(', ')}
                    </div>
                  </div>
                ` : `
                  <div class="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-xs text-slate-500 flex items-center gap-2">
                    <i data-lucide="check" class="w-4 h-4 text-emerald-500"></i>
                    <span>No overspent categories. All spending covered!</span>
                  </div>
                `}

                <!-- Unapproved Transactions Alert -->
                ${metrics.alerts.unapprovedCount > 0 ? `
                  <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                    <div class="flex items-center justify-between font-semibold text-amber-600 dark:text-amber-400">
                      <span class="flex items-center gap-1.5"><i data-lucide="clock" class="w-4 h-4"></i> Unapproved Transactions</span>
                      <span>${metrics.alerts.unapprovedCount} pending</span>
                    </div>
                    <p class="mt-1 text-slate-600 dark:text-slate-300">Review newly imported bank transactions to keep budget accurate.</p>
                  </div>
                ` : ''}

                <!-- Unreconciled Accounts Alert -->
                ${metrics.alerts.unreconciledAccounts.length > 0 ? `
                  <div class="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs">
                    <div class="flex items-center justify-between font-semibold text-sky-600 dark:text-sky-400">
                      <span class="flex items-center gap-1.5"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Reconciliation Due</span>
                      <span>${metrics.alerts.unreconciledAccounts.length} accounts</span>
                    </div>
                    <p class="mt-1 text-slate-600 dark:text-slate-300">
                      ${metrics.alerts.unreconciledAccounts.map(a => a.name).join(', ')} haven't been reconciled in > 14 days.
                    </p>
                  </div>
                ` : ''}
              </div>
            </div>

            <div class="pt-3 text-right">
              <span class="text-[11px] text-slate-400">Updated from local SQLite cache</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Render Burn Rate Gauge Chart
    const gaugeEl = container.querySelector('#burn-gauge-chart');
    if (gaugeEl) {
      ChartFactory.renderBurnRateGauge(gaugeEl, metrics.currentMonth.expense, burnData.burn3M);
    }

    if (window.lucide) window.lucide.createIcons({ root: container });
  }
};
