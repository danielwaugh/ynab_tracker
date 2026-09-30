/**
 * Budget & Category Intelligence View
 */
import { Queries } from '../../db/queries.js';
import { FinancialMath } from '../../services/financial-math.js';
import { ChartFactory } from '../../charts/chart-factory.js';
import { state } from '../../state.js';

export const BudgetView = {
  render(container) {
    const budgetId = state.get('selectedBudgetId');
    if (!budgetId) {
      container.innerHTML = `<div class="p-8 text-center text-slate-500">No budget selected.</div>`;
      return;
    }

    const groups = Queries.getCategoryGroupsWithCategories(budgetId);
    const sinkingFunds = Queries.getSinkingFunds(budgetId);

    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthElapsedPct = Math.round((currentDay / daysInMonth) * 100);

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Pacing Header Banner -->
        <div class="glass-panel p-6 rounded-2xl">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <i data-lucide="gauge" class="w-5 h-5 text-indigo-500"></i>
                Category Spending Pacing Tracker
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Comparing current spend against the <b>${monthElapsedPct}%</b> time elapsed in this month (Day ${currentDay} of ${daysInMonth}).
              </p>
            </div>
            
            <!-- Legend Badges -->
            <div class="flex items-center gap-2 flex-wrap text-xs">
              <span class="px-2.5 py-1 rounded-full font-medium badge-pacing-green flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span> On Track
              </span>
              <span class="px-2.5 py-1 rounded-full font-medium badge-pacing-amber flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-amber-500"></span> Caution (>5% ahead)
              </span>
              <span class="px-2.5 py-1 rounded-full font-medium badge-pacing-red flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-rose-500"></span> Fast Burn / Overspent
              </span>
            </div>
          </div>

          <!-- Month Elapsed Progress Bar -->
          <div class="mt-4">
            <div class="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              <span>Month Time Elapsed: ${monthElapsedPct}%</span>
              <span>${daysInMonth - currentDay} days remaining</span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div class="h-full bg-indigo-500 rounded-full transition-all duration-500" style="width: ${monthElapsedPct}%"></div>
            </div>
          </div>
        </div>

        <!-- Category Groups Breakdown -->
        <div class="space-y-4">
          <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">Category Groups</h3>
          
          ${groups.map(group => {
            const groupSpent = Math.abs(Math.min(0, group.activity));
            const groupPct = group.assigned > 0 ? Math.round((groupSpent / group.assigned) * 100) : 0;

            return `
              <div class="glass-panel rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800/80">
                <!-- Group Header -->
                <div class="p-4 bg-slate-100/60 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800">
                  <div class="flex items-center gap-3">
                    <span class="font-bold text-slate-900 dark:text-slate-100">${group.name}</span>
                    <span class="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      ${group.categories.length} categories
                    </span>
                  </div>
                  <div class="flex items-center gap-6 text-xs sm:text-sm">
                    <div>
                      <span class="text-slate-400 text-xs block">Assigned</span>
                      <span class="font-semibold text-slate-800 dark:text-slate-200">${FinancialMath.formatCurrency(group.assigned)}</span>
                    </div>
                    <div>
                      <span class="text-slate-400 text-xs block">Activity</span>
                      <span class="font-semibold text-slate-800 dark:text-slate-200">${FinancialMath.formatCurrency(group.activity)}</span>
                    </div>
                    <div>
                      <span class="text-slate-400 text-xs block">Available</span>
                      <span class="font-semibold ${group.balance < 0 ? 'text-rose-500' : 'text-emerald-500'}">
                        ${FinancialMath.formatCurrency(group.balance)}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Sub-categories Table -->
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs">
                    <thead>
                      <tr class="text-slate-400 uppercase tracking-wider border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30">
                        <th class="py-2.5 px-4 font-semibold">Category</th>
                        <th class="py-2.5 px-4 font-semibold text-right">Assigned</th>
                        <th class="py-2.5 px-4 font-semibold text-right">Activity</th>
                        <th class="py-2.5 px-4 font-semibold text-right">Available</th>
                        <th class="py-2.5 px-4 font-semibold text-center">Pacing Status</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
                      ${group.categories.map(cat => {
                        const pacing = FinancialMath.calculatePacing(cat.budgeted, cat.activity);
                        let badgeClass = 'badge-pacing-green';
                        if (pacing.status === 'amber') badgeClass = 'badge-pacing-amber';
                        if (pacing.status === 'red') badgeClass = 'badge-pacing-red';

                        return `
                          <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td class="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                              ${cat.name}
                            </td>
                            <td class="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300">
                              ${FinancialMath.formatCurrency(cat.budgeted)}
                            </td>
                            <td class="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300">
                              ${FinancialMath.formatCurrency(cat.activity)}
                            </td>
                            <td class="py-2.5 px-4 text-right font-medium ${cat.balance < 0 ? 'text-rose-500' : 'text-emerald-500'}">
                              ${FinancialMath.formatCurrency(cat.balance)}
                            </td>
                            <td class="py-2.5 px-4 text-center">
                              <span class="px-2 py-0.5 rounded-full font-semibold text-[11px] ${badgeClass}">
                                ${pacing.label} (${pacing.spentPct}%)
                              </span>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Sinking Fund Target Health Table -->
        <div class="glass-panel p-6 rounded-2xl space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <i data-lucide="target" class="w-5 h-5 text-emerald-500"></i>
                Sinking Fund Target Health
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Progress tracking for long-term goals and periodic lump-sum expenses.
              </p>
            </div>
            <span class="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-500 font-medium">
              ${sinkingFunds.length} Active Targets
            </span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th class="py-3 px-4 font-semibold">Category</th>
                  <th class="py-3 px-4 font-semibold">Target Amount</th>
                  <th class="py-3 px-4 font-semibold">Current Balance</th>
                  <th class="py-3 px-4 font-semibold">Target Date</th>
                  <th class="py-3 px-4 font-semibold text-right">Progress</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                ${sinkingFunds.map(sf => {
                  const pct = Math.min(100, Math.max(0, sf.goal_percentage_complete || Math.round((sf.balance / sf.goal_target) * 100)));
                  return `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td class="py-3 px-4">
                        <span class="font-medium text-slate-800 dark:text-slate-200 block">${sf.name}</span>
                        <span class="text-[11px] text-slate-400">${sf.group_name}</span>
                      </td>
                      <td class="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                        ${FinancialMath.formatCurrency(sf.goal_target)}
                      </td>
                      <td class="py-3 px-4 font-medium text-emerald-500">
                        ${FinancialMath.formatCurrency(sf.balance)}
                      </td>
                      <td class="py-3 px-4 text-slate-500 dark:text-slate-400">
                        ${sf.goal_target_month || 'Ongoing Need'}
                      </td>
                      <td class="py-3 px-4 text-right">
                        <div class="flex items-center justify-end gap-2">
                          <div class="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div class="h-full bg-emerald-500 rounded-full" style="width: ${pct}%"></div>
                          </div>
                          <span class="font-semibold text-slate-800 dark:text-slate-200 w-10 text-right">${pct}%</span>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 12-Month Category Spending Drift & Variance Analysis -->
        <div class="glass-panel p-6 rounded-2xl space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <i data-lucide="line-chart" class="w-5 h-5 text-indigo-500"></i>
                12-Month Category Spending Drift & Trend Analysis
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Examine historical spending variance and compare monthly outflows against average baseline spend.
              </p>
            </div>

            <!-- Category Selector Dropdown -->
            <div class="flex items-center gap-2">
              <label for="category-trend-select" class="text-xs text-slate-400 font-medium">Category:</label>
              <select id="category-trend-select" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <!-- Injected via categories -->
              </select>
            </div>
          </div>

          <div id="category-trend-chart" class="w-full h-72"></div>
        </div>
      </div>
    `;

    // Initialize 12-Month Category Trend
    const allCategories = Queries.getAllActiveCategories(budgetId);
    const catSelect = container.querySelector('#category-trend-select');
    const chartEl = container.querySelector('#category-trend-chart');

    if (catSelect && allCategories.length > 0) {
      allCategories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.group_name} → ${c.name}`;
        catSelect.appendChild(opt);
      });

      const updateTrend = () => {
        const catId = catSelect.value;
        const selectedCat = allCategories.find(c => c.id === catId);
        const name = selectedCat ? selectedCat.name : 'Category';
        const trends = Queries.getCategoryMonthlyTrends(budgetId, catId, 12);
        if (chartEl) {
          ChartFactory.renderCategoryTrendChart(chartEl, trends, name);
        }
      };

      catSelect.addEventListener('change', updateTrend);
      updateTrend();
    }

    if (window.lucide) window.lucide.createIcons({ root: container });
  }
};
