/**
 * Financial Mathematics, Calculations & Forecasting Engine
 */

export const FinancialMath = {
  /**
   * Formats milliunits to currency string ($1,234.56)
   */
  formatCurrency(milliunits, symbol = '$', decimals = 2) {
    if (milliunits === null || milliunits === undefined || isNaN(milliunits)) {
      return `${symbol}0.00`;
    }
    const val = milliunits / 1000.0;
    const sign = val < 0 ? '-' : '';
    const absVal = Math.abs(val);
    const parts = absVal.toFixed(decimals).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${sign}${symbol}${parts.join('.')}`;
  },

  /**
   * Formats compact currency ($1.2k, $4.5M)
   */
  formatCompactCurrency(milliunits, symbol = '$') {
    if (!milliunits) return `${symbol}0`;
    const val = milliunits / 1000.0;
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';

    if (abs >= 1_000_000) {
      return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
    }
    if (abs >= 1_000) {
      return `${sign}${symbol}${(abs / 1_000).toFixed(1)}k`;
    }
    return `${sign}${symbol}${abs.toFixed(0)}`;
  },

  /**
   * Computes pacing for a given category based on current day of month
   */
  calculatePacing(budgetedMilliunits, activityMilliunits) {
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthProgressPct = (currentDay / daysInMonth) * 100;

    const assigned = Math.max(0, budgetedMilliunits);
    const spent = Math.abs(Math.min(0, activityMilliunits));

    if (assigned === 0) {
      return {
        status: spent > 0 ? 'red' : 'neutral',
        label: spent > 0 ? 'Unbudgeted Spend' : 'No Budget',
        spentPct: 0,
        monthProgressPct,
        diffPct: 0
      };
    }

    const spentPct = (spent / assigned) * 100;
    const diffPct = spentPct - monthProgressPct;

    let status = 'green';
    let label = 'On Track';

    if (spent > assigned) {
      status = 'red';
      label = 'Overspent';
    } else if (diffPct > 15) {
      status = 'red';
      label = 'Fast Burn';
    } else if (diffPct > 5) {
      status = 'amber';
      label = 'Pacing Ahead';
    } else {
      status = 'green';
      label = 'On Track';
    }

    return {
      status,
      label,
      spentPct: Math.round(spentPct),
      monthProgressPct: Math.round(monthProgressPct),
      diffPct: Math.round(diffPct)
    };
  },

  /**
   * Calculates Runway in months for a given liquid cash balance and monthly burn rate
   */
  calculateRunway(liquidCashMilliunits, monthlyBurnMilliunits) {
    if (!monthlyBurnMilliunits || monthlyBurnMilliunits <= 0) {
      return { months: 999, formatted: '∞ (No Outflows)' };
    }
    const months = (liquidCashMilliunits / monthlyBurnMilliunits);
    if (months <= 0) return { months: 0, formatted: '0 months' };
    if (months > 120) return { months: 120, formatted: '> 10 years' };
    return {
      months: Number(months.toFixed(1)),
      formatted: `${months.toFixed(1)} mos`
    };
  },

  /**
   * Simulates Debt Payoff using Snowball (lowest balance first) and Avalanche (highest APR first)
   * 
   * @param {Array} debts - [{ id, name, balance (milliunits), apr (e.g. 21.99), minPayment (milliunits) }]
   * @param {number} extraMonthlyPaymentMilliunits - Extra cash thrown at debt each month
   */
  simulateDebtPayoff(debts, extraMonthlyPaymentMilliunits = 0) {
    if (!debts || debts.length === 0) {
      return { snowball: null, avalanche: null };
    }

    // Default APRs if missing (credit card ~22%, auto ~6%, student ~5%)
    const normalizedDebts = debts.map(d => ({
      id: d.id,
      name: d.name,
      balance: Math.abs(d.balance_milliunits || d.balance),
      apr: d.apr || (d.type === 'creditCard' ? 22.99 : 6.5),
      minPayment: d.minPayment || Math.max(25000, Math.round(Math.abs(d.balance_milliunits || d.balance) * 0.025)) // 2.5% or $25
    }));

    const runSimulation = (strategy) => {
      // Clone debts
      let activeDebts = normalizedDebts.map(d => ({ ...d }));
      
      // Sort debts: snowball = lowest balance first; avalanche = highest APR first
      if (strategy === 'snowball') {
        activeDebts.sort((a, b) => a.balance - b.balance);
      } else {
        activeDebts.sort((a, b) => b.apr - a.apr);
      }

      let month = 0;
      let totalInterestPaid = 0;
      const history = [];
      const MAX_MONTHS = 360; // 30 years cap

      while (activeDebts.some(d => d.balance > 0) && month < MAX_MONTHS) {
        month++;
        let monthlyExtraPool = extraMonthlyPaymentMilliunits;
        let monthStartBalance = activeDebts.reduce((sum, d) => sum + d.balance, 0);
        let monthInterest = 0;

        // 1. Accrue monthly interest
        for (const debt of activeDebts) {
          if (debt.balance > 0) {
            const monthlyRate = (debt.apr / 100) / 12;
            const interest = Math.round(debt.balance * monthlyRate);
            debt.balance += interest;
            monthInterest += interest;
            totalInterestPaid += interest;
          }
        }

        // 2. Pay minimum payments
        for (const debt of activeDebts) {
          if (debt.balance > 0) {
            const pay = Math.min(debt.balance, debt.minPayment);
            debt.balance -= pay;
            if (debt.balance === 0) {
              // Frees up minimum payment for rollover!
              monthlyExtraPool += debt.minPayment;
            }
          }
        }

        // 3. Apply extra payment to top target debt
        for (const debt of activeDebts) {
          if (debt.balance > 0 && monthlyExtraPool > 0) {
            const extraPay = Math.min(debt.balance, monthlyExtraPool);
            debt.balance -= extraPay;
            monthlyExtraPool -= extraPay;
            if (debt.balance === 0) {
              monthlyExtraPool += debt.minPayment;
            }
          }
        }

        const remainingBalance = activeDebts.reduce((sum, d) => sum + d.balance, 0);
        history.push({
          month,
          remainingBalance,
          interestPaid: totalInterestPaid
        });
      }

      return {
        strategy,
        monthsToPayoff: month,
        totalInterestPaid,
        history
      };
    };

    return {
      snowball: runSimulation('snowball'),
      avalanche: runSimulation('avalanche')
    };
  }
};
