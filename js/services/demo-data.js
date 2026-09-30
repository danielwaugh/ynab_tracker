/**
 * Synthetic 18-Month Realistic YNAB Dataset for Demo Mode & Instant Testing
 */
import { sqliteEngine } from '../db/sqlite-wasm.js';

export const DemoData = {
  BUDGET_ID: 'demo_budget_personal',
  BUDGET_NAME: 'Personal Finances (Demo)',

  /**
   * Seeds the in-browser SQLite database with full demo data
   */
  async seedDatabase() {
    console.log('[DemoData] Seeding synthetic 18-month dataset...');

    // 1. Insert Budget
    sqliteEngine.run(`
      INSERT OR REPLACE INTO budgets (id, name, last_modified_on, first_month, last_month)
      VALUES (?, ?, datetime('now'), '2023-01', strftime('%Y-%m', 'now'));
    `, [this.BUDGET_ID, this.BUDGET_NAME]);

    // 2. Insert Sync Meta
    sqliteEngine.run(`
      INSERT OR REPLACE INTO sync_meta (budget_id, server_knowledge, last_synced_at, currency_format, currency_symbol, currency_decimal_digits)
      VALUES (?, 99999, datetime('now'), 'USD', '$', 2);
    `, [this.BUDGET_ID]);

    // 3. Insert Accounts
    const accounts = [
      { id: 'acc_checking', name: 'Primary Checking', type: 'checking', balance: 4850250, cleared: 4850250, uncleared: 0, reconciled: new Date(Date.now() - 5 * 86400000).toISOString() },
      { id: 'acc_savings', name: 'High-Yield Savings (4.5%)', type: 'savings', balance: 22500000, cleared: 22500000, uncleared: 0, reconciled: new Date(Date.now() - 10 * 86400000).toISOString() },
      { id: 'acc_ira', name: 'Vanguard Total Stock Market ETF', type: 'investment', balance: 38400000, cleared: 38400000, uncleared: 0, reconciled: new Date(Date.now() - 35 * 86400000).toISOString() }, // Unreconciled > 14 days
      { id: 'acc_sapphire', name: 'Sapphire Reserve Card', type: 'creditCard', balance: -1680450, cleared: -1520450, uncleared: -160000, reconciled: new Date(Date.now() - 2 * 86400000).toISOString() },
      { id: 'acc_blue_cash', name: 'Blue Cash Preferred', type: 'creditCard', balance: -415800, cleared: -415800, uncleared: 0, reconciled: new Date(Date.now() - 3 * 86400000).toISOString() },
      { id: 'acc_autoloan', name: 'Honda Financial Auto Loan', type: 'autoLoan', balance: -5800000, cleared: -5800000, uncleared: 0, reconciled: new Date(Date.now() - 25 * 86400000).toISOString() }
    ];

    for (const acc of accounts) {
      sqliteEngine.run(`
        INSERT OR REPLACE INTO accounts (id, budget_id, name, type, on_budget, closed, balance, cleared_balance, uncleared_balance, last_reconciled_at, deleted)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 0);
      `, [acc.id, this.BUDGET_ID, acc.name, acc.type, acc.type === 'investment' ? 0 : 1, acc.balance, acc.cleared, acc.uncleared, acc.reconciled]);
    }

    // 4. Insert Category Groups
    const groups = [
      { id: 'grp_internal', name: 'Internal Master Category' },
      { id: 'grp_immediate', name: 'Immediate Obligations' },
      { id: 'grp_true_expenses', name: 'True Expenses & Sinking Funds' },
      { id: 'grp_quality', name: 'Quality of Life & Discretionary' },
      { id: 'grp_savings', name: 'Long-Term Investments & Goals' }
    ];

    for (const g of groups) {
      sqliteEngine.run(`
        INSERT OR REPLACE INTO category_groups (id, budget_id, name, hidden, deleted)
        VALUES (?, ?, ?, 0, 0);
      `, [g.id, this.BUDGET_ID, g.name]);
    }

    // 5. Insert Categories
    const categories = [
      // Internal
      { id: 'cat_inflow', grp: 'grp_internal', name: 'Inflow: Ready to Assign', budgeted: 0, activity: 0, balance: 650000, goal_type: null, target: 0, month: null, pct: 100 },
      
      // Immediate Obligations
      { id: 'cat_rent', grp: 'grp_immediate', name: 'Rent / Mortgage', budgeted: 1850000, activity: -1850000, balance: 0, goal_type: 'NEED', target: 1850000, month: null, pct: 100 },
      { id: 'cat_groceries', grp: 'grp_immediate', name: 'Groceries & Household', budgeted: 650000, activity: -420000, balance: 230000, goal_type: 'NEED', target: 650000, month: null, pct: 64 },
      { id: 'cat_utilities', grp: 'grp_immediate', name: 'Electric & Gas (PG&E)', budgeted: 160000, activity: -145200, balance: 14800, goal_type: 'NEED', target: 160000, month: null, pct: 90 },
      { id: 'cat_internet', grp: 'grp_immediate', name: 'Fiber Internet (Sonic)', budgeted: 75000, activity: -75000, balance: 0, goal_type: 'NEED', target: 75000, month: null, pct: 100 },
      { id: 'cat_auto_ins', grp: 'grp_immediate', name: 'Auto Insurance (GEICO)', budgeted: 135000, activity: -135000, balance: 0, goal_type: 'NEED', target: 135000, month: null, pct: 100 },
      
      // True Expenses & Sinking Funds
      { id: 'cat_auto_maint', grp: 'grp_true_expenses', name: 'Auto Maintenance & Tires', budgeted: 150000, activity: -45000, balance: 850000, goal_type: 'TB', target: 1500000, month: '2026-12', pct: 56 },
      { id: 'cat_medical', grp: 'grp_true_expenses', name: 'Medical, Dental & Vision', budgeted: 120000, activity: -35000, balance: 620000, goal_type: 'TB', target: 1200000, month: '2027-04', pct: 51 },
      { id: 'cat_home_rep', grp: 'grp_true_expenses', name: 'Home Repairs & Tech Gear', budgeted: 100000, activity: 0, balance: 450000, goal_type: 'TB', target: 1000000, month: '2026-11', pct: 45 },
      { id: 'cat_software', grp: 'grp_true_expenses', name: 'Annual Software Subscriptions', budgeted: 50000, activity: -24000, balance: 280000, goal_type: 'TBD', target: 400000, month: '2026-10', pct: 70 },
      
      // Quality of Life
      { id: 'cat_dining', grp: 'grp_quality', name: 'Dining Out & Coffee', budgeted: 300000, activity: -345000, balance: -45000, goal_type: 'NEED', target: 300000, month: null, pct: 115 }, // Overspent demo
      { id: 'cat_fitness', grp: 'grp_quality', name: 'Gym & Climbing Club', budgeted: 95000, activity: -95000, balance: 0, goal_type: 'NEED', target: 95000, month: null, pct: 100 },
      { id: 'cat_travel', grp: 'grp_quality', name: 'Vacation & Travel Fund', budgeted: 350000, activity: -120000, balance: 1450000, goal_type: 'TB', target: 3000000, month: '2027-06', pct: 48 },
      { id: 'cat_entertainment', grp: 'grp_quality', name: 'Entertainment & Concerts', budgeted: 150000, activity: -110000, balance: 40000, goal_type: 'NEED', target: 150000, month: null, pct: 73 },

      // Long Term Goals
      { id: 'cat_emergency', grp: 'grp_savings', name: 'Emergency Fund (6 Months)', budgeted: 250000, activity: 0, balance: 15000000, goal_type: 'TB', target: 20000000, month: '2027-12', pct: 75 },
      { id: 'cat_investments', grp: 'grp_savings', name: 'Taxable Brokerage Auto-Invest', budgeted: 500000, activity: -500000, balance: 0, goal_type: 'MF', target: 500000, month: null, pct: 100 }
    ];

    for (const c of categories) {
      sqliteEngine.run(`
        INSERT OR REPLACE INTO categories (id, budget_id, category_group_id, name, hidden, budgeted, activity, balance, goal_type, goal_target, goal_target_month, goal_percentage_complete, deleted)
        VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 0);
      `, [c.id, this.BUDGET_ID, c.grp, c.name, c.budgeted, c.activity, c.balance, c.goal_type, c.target, c.month, c.pct]);
    }

    // 6. Insert Payees
    const payees = [
      { id: 'pay_employer', name: 'Tech Solutions Corp (Payroll)' },
      { id: 'pay_landlord', name: 'Apex Property Management' },
      { id: 'pay_trader_joes', name: "Trader Joe's" },
      { id: 'pay_whole_foods', name: 'Whole Foods Market' },
      { id: 'pay_costco', name: 'Costco Wholesale' },
      { id: 'pay_pge', name: 'Pacific Gas & Electric' },
      { id: 'pay_sonic', name: 'Sonic Telecom' },
      { id: 'pay_geico', name: 'GEICO Auto Insurance' },
      { id: 'pay_chipotle', name: 'Chipotle Mexican Grill' },
      { id: 'pay_sweetgreen', name: 'Sweetgreen' },
      { id: 'pay_blue_bottle', name: 'Blue Bottle Coffee' },
      { id: 'pay_chevron', name: 'Chevron Gas Station' },
      { id: 'pay_equinox', name: 'Equinox Fitness Club' },
      { id: 'pay_amazon', name: 'Amazon.com' },
      { id: 'pay_delta', name: 'Delta Air Lines' },
      { id: 'pay_honda', name: 'Honda Financial Services' },
      { id: 'pay_vanguard', name: 'Vanguard Brokerage Services' }
    ];

    for (const p of payees) {
      sqliteEngine.run(`
        INSERT OR REPLACE INTO payees (id, budget_id, name, deleted)
        VALUES (?, ?, ?, 0);
      `, [p.id, this.BUDGET_ID, p.name]);
    }

    // 7. Generate 18 Months of Daily Realistic Transactions (~400 transactions)
    const transactions = [];
    const today = new Date();
    let transId = 1000;

    // Iterate backwards month by month for 18 months
    for (let m = 0; m < 18; m++) {
      const year = today.getFullYear();
      const monthIndex = today.getMonth() - m;
      const monthDate = new Date(year, monthIndex, 1);
      const yearStr = monthDate.getFullYear();
      const monthStr = String(monthDate.getMonth() + 1).padStart(2, '0');
      const daysInMonth = new Date(yearStr, monthDate.getMonth() + 1, 0).getDate();

      const padDay = (day) => `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;

      // Biweekly Salary Deposits ($3,750 on 1st and 15th)
      transactions.push({
        id: `tx_${transId++}`,
        date: padDay(1),
        amount: 3750000,
        memo: 'Biweekly Direct Deposit - Payroll',
        account_id: 'acc_checking',
        payee_id: 'pay_employer',
        category_id: 'cat_inflow',
        approved: 1
      });
      transactions.push({
        id: `tx_${transId++}`,
        date: padDay(15),
        amount: 3750000,
        memo: 'Biweekly Direct Deposit - Payroll',
        account_id: 'acc_checking',
        payee_id: 'pay_employer',
        category_id: 'cat_inflow',
        approved: 1
      });

      // Monthly Rent ($1,850 on 1st)
      transactions.push({
        id: `tx_${transId++}`,
        date: padDay(1),
        amount: -1850000,
        memo: 'Monthly Apartment Rent',
        account_id: 'acc_checking',
        payee_id: 'pay_landlord',
        category_id: 'cat_rent',
        approved: 1
      });

      // Utilities ($130 - $175 on 8th)
      const utilAmount = Math.round((140 + (m % 5) * 8) * 1000);
      transactions.push({
        id: `tx_${transId++}`,
        date: padDay(8),
        amount: -utilAmount,
        memo: 'Electric & Gas Statement',
        account_id: 'acc_checking',
        payee_id: 'pay_pge',
        category_id: 'cat_utilities',
        approved: 1
      });

      // Internet ($75 on 12th)
      transactions.push({
        id: `tx_${transId++}`,
        date: padDay(12),
        amount: -75000,
        memo: 'Gigabit Fiber Internet',
        account_id: 'acc_checking',
        payee_id: 'pay_sonic',
        category_id: 'cat_internet',
        approved: 1
      });

      // Auto Loan Payment ($320 on 18th)
      transactions.push({
        id: `tx_${transId++}`,
        date: padDay(18),
        amount: -320000,
        memo: 'Honda Auto Loan Principal + Interest',
        account_id: 'acc_checking',
        payee_id: 'pay_honda',
        category_id: null,
        approved: 1
      });

      // Weekly Groceries (~$110 - $160 per trip)
      const groceryDays = [3, 10, 17, 24];
      for (const d of groceryDays) {
        if (d <= daysInMonth) {
          const isCostco = d === 17;
          const amt = isCostco ? Math.round((180 + (m % 3) * 15) * 1000) : Math.round((115 + ((d + m) % 4) * 12) * 1000);
          transactions.push({
            id: `tx_${transId++}`,
            date: padDay(d),
            amount: -amt,
            memo: isCostco ? 'Bulk supplies & pantry items' : 'Weekly fresh produce & essentials',
            account_id: 'acc_sapphire',
            payee_id: isCostco ? 'pay_costco' : 'pay_trader_joes',
            category_id: 'cat_groceries',
            approved: 1
          });
        }
      }

      // Dining Out & Coffee (4-6 times per month)
      const diningDays = [5, 9, 14, 21, 27];
      for (const d of diningDays) {
        if (d <= daysInMonth) {
          const diningPayees = ['pay_chipotle', 'pay_sweetgreen', 'pay_blue_bottle'];
          const pId = diningPayees[(d + m) % diningPayees.length];
          const amt = pId === 'pay_blue_bottle' ? 9500 : Math.round((28 + (d % 3) * 14) * 1000);
          transactions.push({
            id: `tx_${transId++}`,
            date: padDay(d),
            amount: -amt,
            memo: pId === 'pay_blue_bottle' ? 'Pour over & oat milk latte' : 'Dinner with friends',
            account_id: 'acc_sapphire',
            payee_id: pId,
            category_id: 'cat_dining',
            approved: 1
          });
        }
      }

      // Gas ($45 - $55 twice a month)
      for (const d of [6, 20]) {
        if (d <= daysInMonth) {
          transactions.push({
            id: `tx_${transId++}`,
            date: padDay(d),
            amount: -Math.round((48 + (m % 3) * 4) * 1000),
            memo: 'Regular Unleaded Fuel',
            account_id: 'acc_blue_cash',
            payee_id: 'pay_chevron',
            category_id: 'cat_auto_maint',
            approved: 1
          });
        }
      }

      // Gym Membership ($95 on 4th)
      transactions.push({
        id: `tx_${transId++}`,
        date: padDay(4),
        amount: -95000,
        memo: 'Monthly Health & Fitness Membership',
        account_id: 'acc_sapphire',
        payee_id: 'pay_equinox',
        category_id: 'cat_fitness',
        approved: 1
      });

      // Amazon Shopping ($35 - $120 random days)
      if (m % 2 === 0) {
        transactions.push({
          id: `tx_${transId++}`,
          date: padDay(16),
          amount: -Math.round((55 + (m % 4) * 18) * 1000),
          memo: 'Household supplies & books',
          account_id: 'acc_sapphire',
          payee_id: 'pay_amazon',
          category_id: 'cat_entertainment',
          approved: 1
        });
      }

      // Monthly Transfer to Vanguard Brokerage ($500 on 16th)
      transactions.push({
        id: `tx_${transId++}`,
        date: padDay(16),
        amount: -500000,
        memo: 'Automatic Monthly Investment Deposit',
        account_id: 'acc_checking',
        payee_id: 'pay_vanguard',
        category_id: 'cat_investments',
        approved: 1
      });
    }

    // Add 2 unapproved transactions in the current month for the quick alert demo
    const curYearStr = today.getFullYear();
    const curMonthStr = String(today.getMonth() + 1).padStart(2, '0');
    transactions.push({
      id: 'tx_unapproved_1',
      date: `${curYearStr}-${curMonthStr}-02`,
      amount: -34500,
      memo: 'Unverified Online Charge - Verification Needed',
      account_id: 'acc_sapphire',
      payee_id: 'pay_amazon',
      category_id: 'cat_entertainment',
      approved: 0
    });
    transactions.push({
      id: 'tx_unapproved_2',
      date: `${curYearStr}-${curMonthStr}-04`,
      amount: -18200,
      memo: 'Pending Square Terminal Charge',
      account_id: 'acc_sapphire',
      payee_id: 'pay_blue_bottle',
      category_id: 'cat_dining',
      approved: 0
    });

    // Execute bulk insert into transactions table
    for (const t of transactions) {
      sqliteEngine.run(`
        INSERT OR REPLACE INTO transactions (id, budget_id, date, amount, memo, cleared, approved, account_id, payee_id, category_id, deleted)
        VALUES (?, ?, ?, ?, ?, 'cleared', ?, ?, ?, ?, 0);
      `, [t.id, this.BUDGET_ID, t.date, t.amount, t.memo, t.approved, t.account_id, t.payee_id, t.category_id]);
    }

    // Persist to IndexedDB
    await sqliteEngine.persist();
    console.log(`[DemoData] Successfully seeded database with ${transactions.length} transactions, accounts, categories, and sinking funds.`);
  }
};
