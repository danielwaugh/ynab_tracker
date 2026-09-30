/**
 * Advanced Cash Flow & Spending Visualizations View
 */
import { Queries } from '../../db/queries.js';
import { ChartFactory } from '../../charts/chart-factory.js';
import { FinancialMath } from '../../services/financial-math.js';
import { state } from '../../state.js';

export const CashFlowView = {
  render(container) {
    const budgetId = state.get('selectedBudgetId');
    if (!budgetId) {
      container.innerHTML = `<div class="p-8 text-center text-slate-500">No budget selected.</div>`;
      return;
    }

    const timeframe = state.get('selectedTimeframe') || 'current';
    const execMetrics = Queries.getExecutiveMetrics(budgetId, timeframe);
    const monthlyTrends = Queries.getMonthlyTrends(budgetId, 12);
    const spendingVelocity = Queries.getSpendingVelocity(budgetId, 365);
    const payeePareto = Queries.getPayeePareto(budgetId, 12);
    const groups = Queries.getCategoryGroupsWithCategories(budgetId);

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Sankey & Waterfall Diagram Section with Switcher -->
        <div class="glass-panel p-6 rounded-2xl">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <i data-lucide="git-merge" class="w-5 h-5 text-indigo-500"></i>
                Cash Flow Allocation Intelligence
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Visualizing funds flow from Income streams through Category Groups down to individual Spending allocations and Net Savings.
              </p>
            </div>

            <!-- Visualization Mode Switcher Buttons -->
            <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
              <button id="view-sankey-btn" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm transition-all flex items-center gap-1.5">
                <i data-lucide="git-merge" class="w-3.5 h-3.5"></i> Sankey Flow
              </button>
              <button id="view-waterfall-btn" class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all flex items-center gap-1.5">
                <i data-lucide="bar-chart-2" class="w-3.5 h-3.5"></i> Waterfall
              </button>
            </div>
          </div>

          <!-- Flow Chart Canvas Container -->
          <div id="flow-chart-container" class="w-full h-96 sm:h-[450px]"></div>
        </div>

        <!-- 365-Day Daily Spending Velocity Heatmap (Horizontally scrollable on mobile) -->
        <div class="glass-panel p-6 rounded-2xl">
          <div class="flex items-center justify-between mb-2">
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <i data-lucide="flame" class="w-5 h-5 text-rose-500"></i>
                Daily Spending Velocity Heatmap
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Calendar distribution of daily expenses over the trailing 365 days. Darker/hotter cells represent peak expenditure spikes.
              </p>
            </div>
          </div>
          <div class="overflow-x-auto">
            <div id="heatmap-chart" class="min-w-[640px] h-56"></div>
          </div>
        </div>

        <!-- Two Columns: Monthly Trend & Payee Pareto -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Monthly Trend Comparative Bar -->
          <div class="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div class="mb-2">
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <i data-lucide="bar-chart-3" class="w-5 h-5 text-emerald-500"></i>
                Monthly Cash Flow & Cumulative Net Savings
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Historical monthly Income vs. Expense with cumulative savings trajectory line.
              </p>
            </div>
            <div id="monthly-trends-chart" class="w-full h-80"></div>
          </div>

          <!-- Payee Pareto (80/20 Rule) Chart -->
          <div class="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div class="mb-2">
              <div class="flex items-center justify-between">
                <h3 class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <i data-lucide="trending-up" class="w-5 h-5 text-amber-500"></i>
                  Payee Pareto Analysis (80/20 Rule)
                </h3>
                <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-500">
                  Top 80% Spend
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Identifies top payees that account for the vital 80% of total expenses.
              </p>
            </div>
            <div id="payee-pareto-chart" class="w-full h-80"></div>
          </div>
        </div>

        <!-- Top Payees Summary Table -->
        <div class="glass-panel p-6 rounded-2xl">
          <h3 class="text-base font-bold text-slate-900 dark:text-slate-100 mb-4">Top 10 Payee Breakdown</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th class="py-2.5 px-4 font-semibold">Rank</th>
                  <th class="py-2.5 px-4 font-semibold">Payee</th>
                  <th class="py-2.5 px-4 font-semibold text-right">Total Spent</th>
                  <th class="py-2.5 px-4 font-semibold text-center">Transactions</th>
                  <th class="py-2.5 px-4 font-semibold text-right">Avg Ticket Size</th>
                  <th class="py-2.5 px-4 font-semibold text-right">Cumulative %</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                ${payeePareto.slice(0, 10).map(p => `
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td class="py-2.5 px-4 font-bold text-slate-400">#${p.rank}</td>
                    <td class="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200">${p.payeeName}</td>
                    <td class="py-2.5 px-4 text-right font-medium text-slate-900 dark:text-slate-100">
                      ${FinancialMath.formatCurrency(p.totalSpent)}
                    </td>
                    <td class="py-2.5 px-4 text-center text-slate-500">${p.transactionCount}</td>
                    <td class="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300">
                      ${FinancialMath.formatCurrency(p.avgTicket)}
                    </td>
                    <td class="py-2.5 px-4 text-right">
                      <span class="font-semibold ${p.cumulativePercentage <= 80 ? 'text-rose-500' : 'text-slate-400'}">
                        ${p.cumulativePercentage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // 1. Flow Chart Switcher (Sankey vs. Waterfall)
    const flowEl = container.querySelector('#flow-chart-container');
    const sankeyBtn = container.querySelector('#view-sankey-btn');
    const waterfallBtn = container.querySelector('#view-waterfall-btn');

    let currentFlowMode = 'sankey';

    const totalIncomeDollars = Math.max(1, Math.round(execMetrics.currentMonth.income / 1000));
    const groupItems = groups.map(g => ({
      name: g.name,
      amount: Math.round(Math.abs(Math.min(0, g.activity)) / 1000) || Math.round(g.assigned / 1000)
    })).filter(g => g.amount > 0);
    const totalAllocated = groupItems.reduce((acc, g) => acc + g.amount, 0);
    const netSavingsDollars = Math.max(0, totalIncomeDollars - totalAllocated);

    const renderFlowChart = () => {
      if (!flowEl) return;
      if (currentFlowMode === 'sankey') {
        const sankeyData = this.buildSankeyData(groups, totalIncomeDollars);
        ChartFactory.renderSankeyDiagram(flowEl, sankeyData);
        sankeyBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm transition-all flex items-center gap-1.5';
        waterfallBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all flex items-center gap-1.5';
      } else {
        ChartFactory.renderCashFlowWaterfall(flowEl, totalIncomeDollars, groupItems, netSavingsDollars);
        waterfallBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm transition-all flex items-center gap-1.5';
        sankeyBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all flex items-center gap-1.5';
      }
      if (window.lucide) window.lucide.createIcons();
    };

    if (sankeyBtn && waterfallBtn) {
      sankeyBtn.addEventListener('click', () => {
        currentFlowMode = 'sankey';
        renderFlowChart();
      });
      waterfallBtn.addEventListener('click', () => {
        currentFlowMode = 'waterfall';
        renderFlowChart();
      });
    }

    renderFlowChart();

    // 2. Render Heatmap
    const heatmapEl = container.querySelector('#heatmap-chart');
    if (heatmapEl) {
      ChartFactory.renderSpendingHeatmap(heatmapEl, spendingVelocity);
    }

    // 3. Render Monthly Trends
    const trendsEl = container.querySelector('#monthly-trends-chart');
    if (trendsEl) {
      ChartFactory.renderMonthlyTrendsBar(trendsEl, monthlyTrends);
    }

    // 4. Render Payee Pareto Chart
    const paretoEl = container.querySelector('#payee-pareto-chart');
    if (paretoEl) {
      ChartFactory.renderPayeeParetoChart(paretoEl, payeePareto);
    }

    if (window.lucide) window.lucide.createIcons({ root: container });
  },

  /**
   * Constructs well-formed DAG for Sankey chart
   */
  buildSankeyData(groups, totalIncomeDollars) {
    const nodes = new Map();
    const links = [];

    const addNode = (name) => {
      if (!nodes.has(name)) {
        nodes.set(name, { name });
      }
    };

    addNode('Total Monthly Income');
    addNode('Budget Allocations');

    let totalAllocatedDollars = 0;

    for (const grp of groups) {
      const grpSpentDollars = Math.round(Math.abs(Math.min(0, grp.activity)) / 1000) || Math.round(grp.assigned / 1000);
      if (grpSpentDollars > 0) {
        const groupNodeName = `${grp.name} `;
        addNode(groupNodeName);
        links.push({
          source: 'Budget Allocations',
          target: groupNodeName,
          value: grpSpentDollars
        });
        totalAllocatedDollars += grpSpentDollars;

        // Top 3 categories per group
        const sortedCats = [...grp.categories].sort((a, b) => Math.abs(b.activity) - Math.abs(a.activity));
        for (const cat of sortedCats.slice(0, 3)) {
          const catSpent = Math.round(Math.abs(Math.min(0, cat.activity)) / 1000) || Math.round(cat.budgeted / 1000);
          if (catSpent > 0) {
            const catNodeName = `${cat.name}  `;
            addNode(catNodeName);
            links.push({
              source: groupNodeName,
              target: catNodeName,
              value: catSpent
            });
          }
        }
      }
    }

    const netSavingsDollars = Math.max(0, totalIncomeDollars - totalAllocatedDollars);
    if (netSavingsDollars > 0) {
      addNode('Net Savings & Investments');
      links.push({
        source: 'Total Monthly Income',
        target: 'Net Savings & Investments',
        value: netSavingsDollars
      });
    }

    links.push({
      source: 'Total Monthly Income',
      target: 'Budget Allocations',
      value: Math.max(1, totalAllocatedDollars)
    });

    return {
      nodes: Array.from(nodes.values()),
      links
    };
  }
};
