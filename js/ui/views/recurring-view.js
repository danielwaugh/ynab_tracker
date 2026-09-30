/**
 * Spending Trends & Recurring Subscriptions Intelligence View
 */
import { Queries } from '../../db/queries.js';
import { ChartFactory } from '../../charts/chart-factory.js';
import { FinancialMath } from '../../services/financial-math.js';
import { state } from '../../state.js';

export const RecurringView = {
  render(container) {
    const budgetId = state.get('selectedBudgetId');
    if (!budgetId) {
      container.innerHTML = `<div class="p-8 text-center text-slate-500">No budget selected. Please configure API Token in Settings.</div>`;
      return;
    }

    const availableMonths = Queries.getAvailableMonths(budgetId);
    const curMonth = availableMonths[0] || new Date().toISOString().substring(0, 7);
    const prevMonth = availableMonths[1] || availableMonths[0] || curMonth;

    const recurring = Queries.getRecurringSubscriptions(budgetId);
    const dayOfWeek = Queries.getDayOfWeekSpending(budgetId, 'last_12m');
    const variance = Queries.getCategoryVariance(budgetId, curMonth, prevMonth);

    // Annualized recurring total
    const totalAnnualMilliunits = recurring.reduce((sum, r) => sum + r.projectedAnnualCost, 0);
    const totalMonthlyMilliunits = Math.round(totalAnnualMilliunits / 12);

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="glass-panel p-6 rounded-2xl">
          <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <i data-lucide="repeat" class="w-5 h-5 text-indigo-500"></i>
            Recurring Subscriptions & Habit Telemetry
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Detect repeating merchant commitments, examine behavioral day-of-week spending patterns, and track category drift.
          </p>
        </div>

        <!-- Metric KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="glass-panel p-4 rounded-2xl flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Detected Recurring Payees</span>
              <i data-lucide="layers" class="w-4 h-4 text-indigo-500"></i>
            </div>
            <div class="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              ${recurring.length} <span class="text-xs font-normal text-slate-500">merchants</span>
            </div>
            <div class="mt-1 text-xs text-slate-500">
              Active repeating commitments
            </div>
          </div>

          <div class="glass-panel p-4 rounded-2xl flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Monthly Recurring Burn</span>
              <i data-lucide="calendar" class="w-4 h-4 text-amber-500"></i>
            </div>
            <div class="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              ${FinancialMath.formatCurrency(totalMonthlyMilliunits)}
            </div>
            <div class="mt-1 text-xs text-slate-500">
              Average committed per month
            </div>
          </div>

          <div class="glass-panel p-4 rounded-2xl flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Annualized Fixed Cost</span>
              <i data-lucide="trending-up" class="w-4 h-4 text-rose-500"></i>
            </div>
            <div class="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              ${FinancialMath.formatCurrency(totalAnnualMilliunits)}
            </div>
            <div class="mt-1 text-xs text-slate-500">
              Projected 12-month outflow
            </div>
          </div>
        </div>

        <!-- Two Column Grid: Day of Week & MoM Variance -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Day of Week Spending Chart -->
          <div class="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div class="mb-2">
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <i data-lucide="clock" class="w-5 h-5 text-indigo-500"></i>
                Day-of-Week Spending Heat
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Aggregated expenditures by weekday over trailing 12 months. Peak spending days highlighted in coral.
              </p>
            </div>
            <div id="day-of-week-chart" class="w-full h-80"></div>
          </div>

          <!-- Month-over-Month Category Variance -->
          <div class="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div>
                <h3 class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <i data-lucide="git-commit" class="w-5 h-5 text-emerald-500"></i>
                  Category Spending Drift
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Change between selected months (+ increase / - savings)
                </p>
              </div>

              <!-- Month Comparators -->
              <div class="flex items-center gap-1.5 self-start sm:self-auto text-xs">
                <select id="variance-curr-month" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold">
                  ${availableMonths.map((m, i) => `<option value="${m}" ${i === 0 ? 'selected' : ''}>${m}</option>`).join('')}
                </select>
                <span class="text-slate-400 font-medium">vs</span>
                <select id="variance-prev-month" class="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold">
                  ${availableMonths.map((m, i) => `<option value="${m}" ${i === 1 ? 'selected' : ''}>${m}</option>`).join('')}
                </select>
              </div>
            </div>
            <div id="variance-divergence-chart" class="w-full h-80"></div>
          </div>
        </div>

        <!-- Recurring Payees Table -->
        <div class="glass-panel p-6 rounded-2xl">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100">Detected Subscriptions & Recurring Bills</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">Merchants with repeat monthly cadence across your budget history.</p>
            </div>
            <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-500">
              ${recurring.length} Detected
            </span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-100/70 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider">
                <tr>
                  <th class="py-2.5 px-4 font-semibold">Merchant / Service</th>
                  <th class="py-2.5 px-4 font-semibold">Category</th>
                  <th class="py-2.5 px-4 font-semibold text-center">Cadence</th>
                  <th class="py-2.5 px-4 font-semibold text-right">Avg Monthly Outflow</th>
                  <th class="py-2.5 px-4 font-semibold text-right">Projected Annual Cost</th>
                  <th class="py-2.5 px-4 font-semibold text-right">Last Charged</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                ${recurring.map(r => `
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td class="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <div class="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                        <i data-lucide="repeat" class="w-3.5 h-3.5"></i>
                      </div>
                      <span>${r.payeeName}</span>
                    </td>
                    <td class="py-2.5 px-4 text-slate-500">
                      <span class="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        ${r.categoryName}
                      </span>
                    </td>
                    <td class="py-2.5 px-4 text-center">
                      <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${r.isConsistent ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}">
                        ${r.isConsistent ? 'Fixed Monthly' : 'Variable Active'}
                      </span>
                    </td>
                    <td class="py-2.5 px-4 text-right font-bold text-slate-900 dark:text-slate-100 font-mono">
                      ${FinancialMath.formatCurrency(r.avgAmount)}
                    </td>
                    <td class="py-2.5 px-4 text-right font-semibold text-rose-500 font-mono">
                      ${FinancialMath.formatCurrency(r.projectedAnnualCost)}
                    </td>
                    <td class="py-2.5 px-4 text-right text-slate-400 font-mono">
                      ${r.lastDate}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Render Charts
    const dowEl = container.querySelector('#day-of-week-chart');
    if (dowEl) {
      ChartFactory.renderDayOfWeekChart(dowEl, dayOfWeek);
    }

    const varianceEl = container.querySelector('#variance-divergence-chart');
    if (varianceEl) {
      ChartFactory.renderCategoryVarianceChart(varianceEl, variance);
    }

    // Month comparator change listeners
    const currSelect = container.querySelector('#variance-curr-month');
    const prevSelect = container.querySelector('#variance-prev-month');

    const updateVariance = () => {
      if (currSelect && prevSelect && varianceEl) {
        const cM = currSelect.value;
        const pM = prevSelect.value;
        const newVariance = Queries.getCategoryVariance(budgetId, cM, pM);
        ChartFactory.renderCategoryVarianceChart(varianceEl, newVariance);
      }
    };

    if (currSelect && prevSelect) {
      currSelect.addEventListener('change', updateVariance);
      prevSelect.addEventListener('change', updateVariance);
    }

    if (window.lucide) window.lucide.createIcons({ root: container });
  }
};
