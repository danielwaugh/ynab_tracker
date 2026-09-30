/**
 * Net Worth & Account Telemetry View with Debt Payoff Simulator
 */
import { Queries } from '../../db/queries.js';
import { ChartFactory } from '../../charts/chart-factory.js';
import { FinancialMath } from '../../services/financial-math.js';
import { state } from '../../state.js';

export const NetWorthView = {
  render(container) {
    const budgetId = state.get('selectedBudgetId');
    if (!budgetId) {
      container.innerHTML = `<div class="p-8 text-center text-slate-500">No budget selected.</div>`;
      return;
    }

    const netWorthHistory = Queries.getNetWorthHistory(budgetId);
    const accountDistribution = Queries.getAccountDistribution(budgetId);
    const debts = Queries.getDebts(budgetId);

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Historical Net Worth Stacked Area Chart -->
        <div class="glass-panel p-6 rounded-2xl">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <i data-lucide="layers" class="w-5 h-5 text-sky-500"></i>
                Historical Net Worth Telemetry (Assets vs. Liabilities)
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Visualizing cumulative asset growth stacked against debt obligations over time.
              </p>
            </div>
          </div>
          <div id="networth-area-chart" class="w-full h-80 sm:h-96"></div>
        </div>

        <!-- Account Distribution & Asset Class Breakdown -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <i data-lucide="pie-chart" class="w-5 h-5 text-indigo-500"></i>
                Account Balance Distribution
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Portfolio balance allocation across liquid cash, high-yield savings, investments, and debts.
              </p>
            </div>
            <div id="account-distribution-chart" class="w-full h-72"></div>
          </div>

          <!-- Account Class List Summary -->
          <div class="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <h3 class="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">Asset & Liability Summary</h3>
            <div class="divide-y divide-slate-100 dark:divide-slate-800">
              ${accountDistribution.map(acc => `
                <div class="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span class="font-semibold text-slate-800 dark:text-slate-200 block">${acc.category}</span>
                    <span class="text-slate-400 text-[11px]">${acc.account_count} accounts</span>
                  </div>
                  <span class="font-bold text-sm ${acc.total_balance < 0 ? 'text-rose-500' : 'text-emerald-500'}">
                    ${FinancialMath.formatCurrency(acc.total_balance)}
                  </span>
                </div>
              `).join('')}
            </div>
            <div class="pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400">
              Balances calculated from latest reconciled account sync records.
            </div>
          </div>
        </div>

        <!-- Debt Payoff Simulator: Snowball vs Avalanche -->
        <div class="glass-panel p-6 rounded-2xl space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 class="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <i data-lucide="calculator" class="w-5 h-5 text-rose-500"></i>
                Debt Payoff Engine: Snowball vs. Avalanche Simulator
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Compare psychological momentum (Snowball: lowest balance first) against mathematical optimization (Avalanche: highest interest rate first).
              </p>
            </div>

            <!-- Extra Monthly Payment Selector -->
            <div class="flex items-center gap-3 bg-slate-100 dark:bg-slate-800/80 p-2 rounded-xl">
              <label for="extra-payment-input" class="text-xs font-semibold text-slate-600 dark:text-slate-300">Extra Monthly Payment:</label>
              <div class="flex items-center gap-1">
                <span class="text-xs font-bold text-slate-400">$</span>
                <input id="extra-payment-input" type="number" min="0" step="50" value="250" class="w-20 px-2 py-1 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-right">
              </div>
            </div>
          </div>

          <!-- Debt Payoff Comparison Results Cards -->
          <div id="debt-simulation-results" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Injected via simulation updater -->
          </div>

          <!-- Debt Payoff Timeline Comparison Chart -->
          <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Simulated Payoff Trajectory (Remaining Balance vs Month)</h4>
            <div id="debt-payoff-timeline-chart" class="w-full h-64"></div>
          </div>

          <!-- Active Debts Table -->
          <div class="overflow-x-auto">
            <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tracked Liability Accounts</h4>
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th class="py-2.5 px-4 font-semibold">Account</th>
                  <th class="py-2.5 px-4 font-semibold">Type</th>
                  <th class="py-2.5 px-4 font-semibold text-right">Current Balance</th>
                  <th class="py-2.5 px-4 font-semibold text-right">Est. APR</th>
                  <th class="py-2.5 px-4 font-semibold text-right">Est. Min Payment</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                ${debts.map(d => {
                  const apr = d.type === 'creditCard' ? 22.99 : 6.5;
                  const minPay = Math.max(25000, Math.round(d.balance_milliunits * 0.025));
                  return `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td class="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">${d.name}</td>
                      <td class="py-2.5 px-4 text-slate-500 capitalize">${d.type}</td>
                      <td class="py-2.5 px-4 text-right font-semibold text-rose-500">
                        ${FinancialMath.formatCurrency(d.balance_milliunits)}
                      </td>
                      <td class="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300 font-medium">${apr}%</td>
                      <td class="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300">
                        ${FinancialMath.formatCurrency(minPay)}/mo
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // 1. Render Net Worth Stacked Area Chart
    const netWorthEl = container.querySelector('#networth-area-chart');
    if (netWorthEl) {
      ChartFactory.renderNetWorthAreaChart(netWorthEl, netWorthHistory);
    }

    // 2. Render Account Distribution Donut
    const distEl = container.querySelector('#account-distribution-chart');
    if (distEl) {
      ChartFactory.renderAccountDistributionDonut(distEl, accountDistribution);
    }

    // 3. Debt payoff simulation handler
    const updateDebtSimulation = () => {
      const extraDollars = parseFloat(container.querySelector('#extra-payment-input')?.value || 0);
      const extraMilliunits = Math.round(extraDollars * 1000);
      const sim = FinancialMath.simulateDebtPayoff(debts, extraMilliunits);

      const resultsEl = container.querySelector('#debt-simulation-results');
      if (!resultsEl) return;

      if (!sim.snowball || !sim.avalanche) {
        resultsEl.innerHTML = `<div class="col-span-2 p-4 text-center text-xs text-slate-400">No active debts detected! You are debt-free.</div>`;
        return;
      }

      const interestSavedWithAvalanche = Math.max(0, sim.snowball.totalInterestPaid - sim.avalanche.totalInterestPaid);

      resultsEl.innerHTML = `
        <!-- Snowball Strategy -->
        <div class="p-5 rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Snowball Method</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-500">Fastest Quick Wins</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-3xl font-extrabold text-slate-900 dark:text-slate-100">${sim.snowball.monthsToPayoff}</span>
            <span class="text-xs text-slate-500 font-medium">Months to Debt Freedom</span>
          </div>
          <div class="mt-2 text-xs text-slate-600 dark:text-slate-300">
            Total Interest Paid: <b class="text-rose-500">${FinancialMath.formatCurrency(sim.snowball.totalInterestPaid)}</b>
          </div>
          <p class="mt-3 text-[11px] text-slate-500 leading-relaxed">
            Eliminates smallest balances first to rapidly free up monthly minimum cash flow and provide rapid psychological milestones.
          </p>
        </div>

        <!-- Avalanche Strategy -->
        <div class="p-5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Avalanche Method</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500">Maximum Interest Saved</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-3xl font-extrabold text-slate-900 dark:text-slate-100">${sim.avalanche.monthsToPayoff}</span>
            <span class="text-xs text-slate-500 font-medium">Months to Debt Freedom</span>
          </div>
          <div class="mt-2 text-xs text-slate-600 dark:text-slate-300">
            Total Interest Paid: <b class="text-rose-500">${FinancialMath.formatCurrency(sim.avalanche.totalInterestPaid)}</b>
            ${interestSavedWithAvalanche > 0 ? `<span class="ml-2 font-bold text-emerald-500">(Saves ${FinancialMath.formatCurrency(interestSavedWithAvalanche)})</span>` : ''}
          </div>
          <p class="mt-3 text-[11px] text-slate-500 leading-relaxed">
            Targets highest interest rate accounts first to minimize total compounding interest paid to lenders.
          </p>
        </div>
      `;

      // Render Debt Payoff Timeline Line Chart
      const timelineChartEl = container.querySelector('#debt-payoff-timeline-chart');
      if (timelineChartEl) {
        ChartFactory.renderDebtPayoffTimelineChart(
          timelineChartEl,
          sim.snowball.history,
          sim.avalanche.history
        );
      }
    };

    updateDebtSimulation();

    const extraInput = container.querySelector('#extra-payment-input');
    if (extraInput) {
      extraInput.addEventListener('input', updateDebtSimulation);
    }

    if (window.lucide) window.lucide.createIcons({ root: container });
  }
};
