/**
 * High-Performance Analytical Queries for Dashboard Views & Metrics
 */
import { sqliteEngine } from './sqlite-wasm.js';

export const Queries = {
  /**
   * Retrieves high-level Executive Metrics
   */
  /**
   * Computes ISO start & end dates and a human label for a given timeframe
   */
  getTimeframeBounds(timeframe = 'current') {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth(); // 0-indexed

    const pad = (n) => String(n).padStart(2, '0');
    const formatYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // Specific calendar month YYYY-MM
    if (typeof timeframe === 'string' && /^\d{4}-\d{2}$/.test(timeframe)) {
      const [y, m] = timeframe.split('-').map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0); // last day of month
      return {
        startDate: formatYMD(start),
        endDate: formatYMD(end),
        targetMonth: timeframe,
        label: start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      };
    }

    if (timeframe === 'last_month') {
      const start = new Date(curYear, curMonth - 1, 1);
      const end = new Date(curYear, curMonth, 0);
      const monthStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}`;
      return {
        startDate: formatYMD(start),
        endDate: formatYMD(end),
        targetMonth: monthStr,
        label: 'Last Month'
      };
    }

    if (timeframe === 'last_3m') {
      const start = new Date(curYear, curMonth - 2, 1);
      const end = new Date(curYear, curMonth + 1, 0);
      return {
        startDate: formatYMD(start),
        endDate: formatYMD(end),
        targetMonth: `${curYear}-${pad(curMonth + 1)}`,
        label: 'Last 3 Months'
      };
    }

    if (timeframe === 'last_6m') {
      const start = new Date(curYear, curMonth - 5, 1);
      const end = new Date(curYear, curMonth + 1, 0);
      return {
        startDate: formatYMD(start),
        endDate: formatYMD(end),
        targetMonth: `${curYear}-${pad(curMonth + 1)}`,
        label: 'Last 6 Months'
      };
    }

    if (timeframe === 'last_12m') {
      const start = new Date(curYear, curMonth - 11, 1);
      const end = new Date(curYear, curMonth + 1, 0);
      return {
        startDate: formatYMD(start),
        endDate: formatYMD(end),
        targetMonth: `${curYear}-${pad(curMonth + 1)}`,
        label: 'Last 12 Months'
      };
    }

    if (timeframe === 'ytd') {
      const start = new Date(curYear, 0, 1);
      const end = new Date(curYear, curMonth + 1, 0);
      return {
        startDate: formatYMD(start),
        endDate: formatYMD(end),
        targetMonth: `${curYear}-${pad(curMonth + 1)}`,
        label: 'Year to Date'
      };
    }

    if (timeframe === 'all') {
      return {
        startDate: '1970-01-01',
        endDate: '2099-12-31',
        targetMonth: `${curYear}-${pad(curMonth + 1)}`,
        label: 'All Time'
      };
    }

    // Default: 'current'
    const start = new Date(curYear, curMonth, 1);
    const end = new Date(curYear, curMonth + 1, 0);
    const curMonthStr = `${curYear}-${pad(curMonth + 1)}`;
    return {
      startDate: formatYMD(start),
      endDate: formatYMD(end),
      targetMonth: curMonthStr,
      label: 'Current Month'
    };
  },

  /**
   * Retrieves high-level Executive Metrics for selected timeframe
   */
  getExecutiveMetrics(budgetId, timeframe = 'current') {
    // 1. Account balances summary
    const accounts = sqliteEngine.query(`
      SELECT 
        SUM(CASE WHEN balance > 0 AND closed = 0 THEN balance ELSE 0 END) AS total_assets,
        SUM(CASE WHEN balance < 0 AND closed = 0 THEN balance ELSE 0 END) AS total_liabilities,
        SUM(CASE WHEN type IN ('checking', 'savings', 'cash') AND closed = 0 THEN balance ELSE 0 END) AS liquid_cash,
        SUM(CASE WHEN closed = 0 THEN balance ELSE 0 END) AS net_worth
      FROM accounts
      WHERE budget_id = ? AND deleted = 0;
    `, [budgetId])[0] || { total_assets: 0, total_liabilities: 0, liquid_cash: 0, net_worth: 0 };

    // 2. Bounds and official YNAB month records
    const bounds = this.getTimeframeBounds(timeframe);

    // Get official month record from months table
    let monthRow = sqliteEngine.query(`
      SELECT to_be_budgeted, age_of_money, income, activity, month
      FROM months
      WHERE budget_id = ? AND month = ? AND deleted = 0;
    `, [budgetId, bounds.targetMonth])[0];

    // If exact target month not in DB (e.g. system date vs budget date difference), pick closest month <= targetMonth
    if (!monthRow) {
      monthRow = sqliteEngine.query(`
        SELECT to_be_budgeted, age_of_money, income, activity, month
        FROM months
        WHERE budget_id = ? AND month <= ? AND deleted = 0
        ORDER BY month DESC
        LIMIT 1;
      `, [budgetId, bounds.targetMonth])[0];
    }

    // Fallback to latest available month
    if (!monthRow) {
      monthRow = sqliteEngine.query(`
        SELECT to_be_budgeted, age_of_money, income, activity, month
        FROM months
        WHERE budget_id = ? AND deleted = 0
        ORDER BY month DESC
        LIMIT 1;
      `, [budgetId])[0];
    }

    // Ready to Assign from official YNAB to_be_budgeted
    const readyToAssign = monthRow ? (monthRow.to_be_budgeted || 0) : 0;
    const ageOfMoneyDays = monthRow ? (monthRow.age_of_money || 0) : 0;

    // 3. Accurate Cash Flow (Excluding internal transfers & non-budget accounts)
    const cashFlow = sqliteEngine.query(`
      SELECT 
        SUM(CASE 
          WHEN t.amount > 0 
           AND (c.name LIKE 'Inflow%' OR c.name = 'Inflow: Ready to Assign')
           AND t.transfer_account_id IS NULL
           AND a.on_budget = 1
          THEN t.amount 
          ELSE 0 
        END) AS total_income,
        SUM(CASE 
          WHEN t.amount < 0 
           AND c.id IS NOT NULL 
           AND c.name NOT LIKE 'Inflow%'
           AND t.transfer_account_id IS NULL
           AND a.on_budget = 1
          THEN -t.amount 
          WHEN t.amount > 0 
           AND c.id IS NOT NULL 
           AND c.name NOT LIKE 'Inflow%'
           AND t.transfer_account_id IS NULL
           AND a.on_budget = 1
          THEN -t.amount -- Refunds / returns reduce expense
          ELSE 0 
        END) AS total_expense
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.budget_id = ? 
        AND t.deleted = 0 
        AND t.date >= ? 
        AND t.date <= ?;
    `, [budgetId, bounds.startDate, bounds.endDate])[0] || { total_income: 0, total_expense: 0 };

    let income = cashFlow.total_income || 0;
    let expense = cashFlow.total_expense || 0;

    // Prioritize official YNAB months aggregates when available
    const startMonth = bounds.startDate.substring(0, 7);
    const endMonth = bounds.endDate.substring(0, 7);

    const multiMonthAgg = sqliteEngine.query(`
      SELECT 
        SUM(income) as total_income,
        SUM(ABS(activity)) as total_expense
      FROM months
      WHERE budget_id = ? AND month >= ? AND month <= ? AND deleted = 0;
    `, [budgetId, startMonth, endMonth])[0];

    if (multiMonthAgg && (multiMonthAgg.total_income > 0 || multiMonthAgg.total_expense > 0)) {
      income = multiMonthAgg.total_income || 0;
      expense = multiMonthAgg.total_expense || 0;
    } else if (monthRow && (timeframe === 'current' || /^\d{4}-\d{2}$/.test(timeframe) || timeframe === 'last_month')) {
      if (monthRow.income > 0) income = monthRow.income;
      if (monthRow.activity !== 0) expense = Math.abs(monthRow.activity);
    }

    const net = income - expense;
    const savingsRate = income > 0 ? Math.max(0, Math.round((net / income) * 100)) : 0;

    // 4. Overspent categories
    const overspentCategories = sqliteEngine.query(`
      SELECT c.id, c.name, c.balance, cg.name AS group_name
      FROM categories c
      JOIN category_groups cg ON c.category_group_id = cg.id
      WHERE c.budget_id = ? AND c.balance < 0 AND c.deleted = 0 AND c.hidden = 0
      ORDER BY c.balance ASC;
    `, [budgetId]);

    // 5. Total Underfunded
    const underfundedRow = sqliteEngine.query(`
      SELECT SUM(goal_target - balance) AS total_underfunded
      FROM categories
      WHERE budget_id = ? AND deleted = 0 AND hidden = 0 AND goal_target > 0 AND balance < goal_target;
    `, [budgetId])[0];
    const totalUnderfunded = underfundedRow?.total_underfunded || 0;

    // 6. Unapproved transactions
    const unapprovedCount = sqliteEngine.query(`
      SELECT COUNT(*) AS count FROM transactions 
      WHERE budget_id = ? AND approved = 0 AND deleted = 0;
    `, [budgetId])[0]?.count || 0;

    // 7. Unreconciled accounts older than 14 days
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
    const unreconciledAccounts = sqliteEngine.query(`
      SELECT id, name, type, balance, last_reconciled_at
      FROM accounts
      WHERE budget_id = ? AND closed = 0 AND deleted = 0
        AND (last_reconciled_at IS NULL OR last_reconciled_at < ?)
      ORDER BY balance DESC;
    `, [budgetId, fourteenDaysAgo]);

    return {
      netWorth: accounts.net_worth || 0,
      totalAssets: accounts.total_assets || 0,
      totalLiabilities: accounts.total_liabilities || 0,
      liquidCash: accounts.liquid_cash || 0,
      readyToAssign,
      ageOfMoneyDays,
      totalUnderfunded,
      timeframeLabel: bounds.label,
      currentMonth: {
        month: bounds.targetMonth,
        income,
        expense,
        net,
        savingsRate
      },
      alerts: {
        overspent: overspentCategories,
        unapprovedCount,
        unreconciledAccounts
      }
    };
  },

  /**
   * Retrieves available months from SQLite for dropdown selection
   */
  getAvailableMonths(budgetId) {
    const fromMonths = sqliteEngine.query(`
      SELECT DISTINCT month FROM months
      WHERE budget_id = ? AND deleted = 0
      ORDER BY month DESC;
    `, [budgetId]);

    if (fromMonths.length > 0) {
      return fromMonths.map(m => m.month);
    }

    const fromTx = sqliteEngine.query(`
      SELECT DISTINCT SUBSTR(date, 1, 7) AS month
      FROM transactions
      WHERE budget_id = ? AND deleted = 0
      ORDER BY month DESC;
    `, [budgetId]);

    return fromTx.map(m => m.month);
  },

  /**
   * Calculates Rolling Average Monthly Burn Rate for 3, 6, and 12 months
   */
  getRollingBurnRate(budgetId) {
    // Exclude internal transfers and non-budget accounts
    const rows = sqliteEngine.query(`
      SELECT 
        SUBSTR(t.date, 1, 7) AS month,
        SUM(CASE 
          WHEN t.amount < 0 AND c.name NOT LIKE 'Inflow%' AND c.id IS NOT NULL AND t.transfer_account_id IS NULL AND a.on_budget = 1 
          THEN -t.amount 
          ELSE 0 
        END) AS total_expense
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      JOIN categories c ON t.category_id = c.id
      WHERE t.budget_id = ? AND t.deleted = 0
      GROUP BY SUBSTR(t.date, 1, 7)
      ORDER BY month DESC
      LIMIT 12;
    `, [budgetId]);

    const calculateAvg = (monthsCount) => {
      const subset = rows.slice(0, monthsCount);
      if (subset.length === 0) return 0;
      const sum = subset.reduce((acc, row) => acc + (row.total_expense || 0), 0);
      return Math.round(sum / subset.length);
    };

    return {
      burn3M: calculateAvg(3),
      burn6M: calculateAvg(6),
      burn12M: calculateAvg(12),
      monthlyHistory: rows.reverse()
    };
  },

  /**
   * Retrieves historical monthly income vs. expense for trend charts
   */
  getMonthlyTrends(budgetId, limitMonths = 12) {
    // 1. Try official YNAB months table first
    const officialMonths = sqliteEngine.query(`
      SELECT month, income, ABS(activity) AS expense
      FROM months
      WHERE budget_id = ? AND deleted = 0
      ORDER BY month DESC
      LIMIT ?;
    `, [budgetId, limitMonths]);

    if (officialMonths.length > 0 && officialMonths.some(m => m.income > 0 || m.expense > 0)) {
      return officialMonths.reverse();
    }

    // 2. Fallback to clean transactions aggregation
    return sqliteEngine.query(`
      SELECT 
        SUBSTR(t.date, 1, 7) AS month,
        SUM(CASE WHEN t.amount > 0 AND c.name LIKE 'Inflow%' AND t.transfer_account_id IS NULL AND a.on_budget = 1 THEN t.amount ELSE 0 END) AS income,
        SUM(CASE WHEN t.amount < 0 AND c.id IS NOT NULL AND c.name NOT LIKE 'Inflow%' AND t.transfer_account_id IS NULL AND a.on_budget = 1 THEN -t.amount ELSE 0 END) AS expense
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.budget_id = ? AND t.deleted = 0
      GROUP BY SUBSTR(t.date, 1, 7)
      ORDER BY month DESC
      LIMIT ?;
    `, [budgetId, limitMonths]).reverse();
  },

  /**
   * Retrieves category groups and child categories with assigned, activity, and balance
   */
  getCategoryGroupsWithCategories(budgetId) {
    const groups = sqliteEngine.query(`
      SELECT id, name FROM category_groups
      WHERE budget_id = ? AND deleted = 0 AND hidden = 0
        AND name NOT IN ('Internal Master Category', 'Credit Card Payments')
      ORDER BY name ASC;
    `, [budgetId]);

    const categories = sqliteEngine.query(`
      SELECT 
        c.id, c.category_group_id, c.name, c.budgeted, c.activity, c.balance,
        c.goal_type, c.goal_target, c.goal_target_month, c.goal_percentage_complete
      FROM categories c
      WHERE c.budget_id = ? AND c.deleted = 0 AND c.hidden = 0
        AND c.name NOT LIKE 'Inflow:%'
      ORDER BY c.name ASC;
    `, [budgetId]);

    const groupMap = new Map();
    for (const g of groups) {
      groupMap.set(g.id, {
        id: g.id,
        name: g.name,
        assigned: 0,
        activity: 0,
        balance: 0,
        categories: []
      });
    }

    for (const cat of categories) {
      if (groupMap.has(cat.category_group_id)) {
        const grp = groupMap.get(cat.category_group_id);
        grp.assigned += cat.budgeted;
        grp.activity += cat.activity;
        grp.balance += cat.balance;
        grp.categories.push(cat);
      }
    }

    return Array.from(groupMap.values()).filter(g => g.categories.length > 0);
  },

  /**
   * Retrieves sinking fund target health data
   */
  getSinkingFunds(budgetId) {
    return sqliteEngine.query(`
      SELECT 
        c.id, c.name, cg.name AS group_name,
        c.budgeted, c.activity, c.balance,
        c.goal_type, c.goal_target, c.goal_target_month, c.goal_percentage_complete
      FROM categories c
      JOIN category_groups cg ON c.category_group_id = cg.id
      WHERE c.budget_id = ? AND c.deleted = 0 AND c.hidden = 0
        AND c.goal_target > 0
      ORDER BY c.goal_percentage_complete ASC;
    `, [budgetId]);
  },

  /**
   * Retrieves daily spending velocity for calendar heatmap
   */
  getSpendingVelocity(budgetId, days = 365) {
    const startDate = new Date(Date.now() - days * 86400000).toISOString().substring(0, 10);
    return sqliteEngine.query(`
      SELECT 
        t.date,
        SUM(CASE WHEN t.amount < 0 AND c.name != 'Inflow: Ready to Assign' AND c.id IS NOT NULL THEN -t.amount ELSE 0 END) AS total_expense,
        COUNT(t.id) AS transaction_count
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.budget_id = ? AND t.deleted = 0 AND t.date >= ?
      GROUP BY t.date
      ORDER BY t.date ASC;
    `, [budgetId, startDate]);
  },

  /**
   * Payee Pareto Analysis (80/20 Rule)
   */
  getPayeePareto(budgetId, limitMonths = 12) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - limitMonths);
    const startStr = startDate.toISOString().substring(0, 10);

    const rows = sqliteEngine.query(`
      SELECT 
        COALESCE(p.name, 'Other / Unassigned') AS payee_name,
        SUM(-t.amount) AS total_spent,
        COUNT(t.id) AS transaction_count,
        ROUND(AVG(-t.amount), 0) AS avg_ticket
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      LEFT JOIN payees p ON t.payee_id = p.id
      WHERE t.budget_id = ? AND t.deleted = 0 
        AND t.amount < 0 AND c.name != 'Inflow: Ready to Assign'
        AND t.date >= ?
      GROUP BY COALESCE(p.name, 'Other / Unassigned')
      ORDER BY total_spent DESC;
    `, [budgetId, startStr]);

    const totalExpense = rows.reduce((sum, r) => sum + r.total_spent, 0);
    let runningSum = 0;

    return rows.map((r, index) => {
      runningSum += r.total_spent;
      return {
        rank: index + 1,
        payeeName: r.payee_name,
        totalSpent: r.total_spent,
        transactionCount: r.transaction_count,
        avgTicket: r.avg_ticket,
        percentageOfTotal: totalExpense > 0 ? (r.total_spent / totalExpense) * 100 : 0,
        cumulativePercentage: totalExpense > 0 ? (runningSum / totalExpense) * 100 : 0
      };
    });
  },

  /**
   * Retrieves Net Worth history by month and account classification
   */
  getNetWorthHistory(budgetId) {
    // Computes monthly cumulative balance by tracking all transactions over time
    const monthlyDeltas = sqliteEngine.query(`
      SELECT 
        SUBSTR(t.date, 1, 7) AS month,
        SUM(CASE WHEN a.type IN ('checking', 'savings', 'cash', 'otherAsset', 'investment') THEN t.amount ELSE 0 END) AS asset_delta,
        SUM(CASE WHEN a.type IN ('creditCard', 'otherDebt', 'autoLoan', 'studentLoan', 'mortgage', 'personalLoan') THEN t.amount ELSE 0 END) AS liability_delta
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.budget_id = ? AND t.deleted = 0
      GROUP BY SUBSTR(t.date, 1, 7)
      ORDER BY month ASC;
    `, [budgetId]);

    let runningAssets = 0;
    let runningLiabilities = 0;

    return monthlyDeltas.map(d => {
      runningAssets += d.asset_delta;
      runningLiabilities += d.liability_delta;
      return {
        month: d.month,
        assets: Math.max(0, runningAssets),
        liabilities: Math.abs(Math.min(0, runningLiabilities)),
        netWorth: runningAssets + runningLiabilities
      };
    });
  },

  /**
   * Retrieves debts for Snowball & Avalanche calculator
   */
  getDebts(budgetId) {
    return sqliteEngine.query(`
      SELECT 
        id, name, type, 
        ABS(balance) AS balance_milliunits,
        ROUND(ABS(balance) / 1000.0, 2) AS balance_dollars
      FROM accounts
      WHERE budget_id = ? AND closed = 0 AND deleted = 0 
        AND balance < 0
        AND type IN ('creditCard', 'otherDebt', 'autoLoan', 'studentLoan', 'mortgage', 'personalLoan')
      ORDER BY ABS(balance) ASC;
    `, [budgetId]);
  },

  /**
   * Retrieves accounts grouped by classification for balance distribution
   */
  getAccountDistribution(budgetId) {
    return sqliteEngine.query(`
      SELECT 
        CASE 
          WHEN type IN ('checking', 'cash') THEN 'Liquid Cash'
          WHEN type = 'savings' THEN 'High-Yield Savings'
          WHEN type = 'investment' THEN 'Investments / 401(k)'
          WHEN type = 'creditCard' THEN 'Credit Cards'
          WHEN type IN ('otherDebt', 'autoLoan', 'studentLoan', 'mortgage') THEN 'Loans & Mortgages'
          ELSE 'Other'
        END AS category,
        SUM(balance) AS total_balance,
        COUNT(id) AS account_count
      FROM accounts
      WHERE budget_id = ? AND closed = 0 AND deleted = 0
      GROUP BY category
      ORDER BY total_balance DESC;
    `, [budgetId]);
  },

  /**
   * Retrieves all non-deleted, active categories for dropdown selection
   */
  getAllActiveCategories(budgetId) {
    return sqliteEngine.query(`
      SELECT c.id, c.name, cg.name AS group_name
      FROM categories c
      JOIN category_groups cg ON c.category_group_id = cg.id
      WHERE c.budget_id = ? AND c.deleted = 0 AND c.hidden = 0
        AND c.name NOT LIKE 'Inflow:%'
      ORDER BY cg.name ASC, c.name ASC;
    `, [budgetId]);
  },

  /**
   * Retrieves 12-month spending trend for a specific category
   */
  getCategoryMonthlyTrends(budgetId, categoryId, limitMonths = 12) {
    return sqliteEngine.query(`
      SELECT 
        SUBSTR(t.date, 1, 7) AS month,
        SUM(CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END) AS spent
      FROM transactions t
      WHERE t.budget_id = ? AND t.category_id = ? AND t.deleted = 0
      GROUP BY SUBSTR(t.date, 1, 7)
      ORDER BY month DESC
      LIMIT ?;
    `, [budgetId, categoryId, limitMonths]).reverse();
  },

  /**
   * Advanced Transaction Explorer Query Hub with rich filtering, search, sorting, and pagination
   */
  getTransactionExplorer(budgetId, options = {}) {
    const {
      search = '',
      accountId = '',
      categoryId = '',
      type = 'all', // 'all' | 'inflow' | 'outflow'
      timeframe = 'all',
      startDate = '',
      endDate = '',
      sortBy = 'date',
      sortDir = 'desc',
      page = 1,
      pageSize = 25
    } = options;

    let conditions = ['t.budget_id = ?', 't.deleted = 0'];
    let params = [budgetId];

    // Timeframe / Date filtering
    if (startDate && endDate) {
      conditions.push('t.date >= ? AND t.date <= ?');
      params.push(startDate, endDate);
    } else if (timeframe && timeframe !== 'all') {
      const bounds = this.getTimeframeBounds(timeframe);
      conditions.push('t.date >= ? AND t.date <= ?');
      params.push(bounds.startDate, bounds.endDate);
    }

    // Account filter
    if (accountId) {
      conditions.push('t.account_id = ?');
      params.push(accountId);
    }

    // Category filter
    if (categoryId) {
      conditions.push('t.category_id = ?');
      params.push(categoryId);
    }

    // Type filter
    if (type === 'inflow') {
      conditions.push('t.amount > 0');
    } else if (type === 'outflow') {
      conditions.push('t.amount < 0');
    }

    // Text search (Payee, Category, Memo)
    if (search.trim()) {
      conditions.push('(p.name LIKE ? OR c.name LIKE ? OR t.memo LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.join(' AND ');

    // Aggregate statistics for filtered set
    const statsQuery = `
      SELECT 
        COUNT(t.id) AS total_count,
        SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) AS total_inflow,
        SUM(CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END) AS total_outflow
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      LEFT JOIN payees p ON t.payee_id = p.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE ${whereClause};
    `;
    const stats = sqliteEngine.query(statsQuery, params)[0] || { total_count: 0, total_inflow: 0, total_outflow: 0 };

    // Sorting map
    const sortColumnMap = {
      date: 't.date',
      amount: 't.amount',
      payee: 'payee_name',
      category: 'category_name',
      account: 'account_name'
    };
    const orderColumn = sortColumnMap[sortBy] || 't.date';
    const orderDirection = sortDir.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Pagination
    const offset = Math.max(0, (page - 1) * pageSize);
    const paginatedParams = [...params, pageSize, offset];

    const dataQuery = `
      SELECT 
        t.id,
        t.date,
        t.amount,
        ROUND(t.amount / 1000.0, 2) AS amount_dollars,
        t.memo,
        t.cleared,
        t.approved,
        t.flag_color,
        t.transfer_account_id,
        a.name AS account_name,
        a.type AS account_type,
        COALESCE(p.name, 'No Payee') AS payee_name,
        COALESCE(c.name, CASE WHEN t.transfer_account_id IS NOT NULL THEN 'Transfer' ELSE 'Uncategorized' END) AS category_name,
        COALESCE(cg.name, 'Unassigned') AS group_name
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      LEFT JOIN payees p ON t.payee_id = p.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN category_groups cg ON c.category_group_id = cg.id
      WHERE ${whereClause}
      ORDER BY ${orderColumn} ${orderDirection}, t.id DESC
      LIMIT ? OFFSET ?;
    `;
    const rows = sqliteEngine.query(dataQuery, paginatedParams);

    const totalCount = stats.total_count || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return {
      rows,
      totalCount,
      totalPages,
      page,
      pageSize,
      totalInflow: stats.total_inflow || 0,
      totalOutflow: stats.total_outflow || 0,
      net: (stats.total_inflow || 0) - (stats.total_outflow || 0)
    };
  },

  /**
   * Recurring Subscriptions & Fixed Expenses Detector
   * Analyzes repeat payees across historical months
   */
  getRecurringSubscriptions(budgetId) {
    const rows = sqliteEngine.query(`
      SELECT 
        COALESCE(p.name, 'Unassigned Merchant') AS payee_name,
        c.name AS category_name,
        COUNT(t.id) AS occurrence_count,
        COUNT(DISTINCT SUBSTR(t.date, 1, 7)) AS month_count,
        ROUND(AVG(-t.amount), 0) AS avg_amount,
        MAX(t.date) AS last_date,
        MIN(t.date) AS first_date,
        MIN(-t.amount) AS min_amount,
        MAX(-t.amount) AS max_amount
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      LEFT JOIN payees p ON t.payee_id = p.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.budget_id = ? 
        AND t.deleted = 0 
        AND t.amount < 0 
        AND t.transfer_account_id IS NULL
        AND a.on_budget = 1
        AND c.name NOT LIKE 'Inflow%'
      GROUP BY COALESCE(p.name, 'Unassigned Merchant')
      HAVING month_count >= 2 AND occurrence_count >= 2
      ORDER BY avg_amount DESC;
    `, [budgetId]);

    return rows.map(r => {
      // Annualized calculation
      const avgDollars = r.avg_amount / 1000.0;
      const annualizedDollars = avgDollars * 12;
      return {
        payeeName: r.payee_name,
        categoryName: r.category_name || 'General',
        occurrenceCount: r.occurrence_count,
        monthCount: r.month_count,
        avgAmount: r.avg_amount,
        lastDate: r.last_date,
        isConsistent: (r.max_amount - r.min_amount) < (r.avg_amount * 0.25), // <25% variance
        projectedAnnualCost: Math.round(annualizedDollars * 1000)
      };
    });
  },

  /**
   * Day-of-Week Behavioral Spending Telemetry (Sun=0 to Sat=6)
   */
  getDayOfWeekSpending(budgetId, timeframe = 'last_12m') {
    const bounds = this.getTimeframeBounds(timeframe);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const rows = sqliteEngine.query(`
      SELECT 
        CAST(strftime('%w', t.date) AS INTEGER) AS day_num,
        SUM(CASE WHEN t.amount < 0 AND t.transfer_account_id IS NULL AND a.on_budget = 1 THEN -t.amount ELSE 0 END) AS total_spent,
        COUNT(t.id) AS tx_count
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      JOIN categories c ON t.category_id = c.id
      WHERE t.budget_id = ? 
        AND t.deleted = 0 
        AND t.date >= ? 
        AND t.date <= ?
        AND c.name NOT LIKE 'Inflow%'
      GROUP BY day_num
      ORDER BY day_num ASC;
    `, [budgetId, bounds.startDate, bounds.endDate]);

    const result = [];
    for (let i = 0; i < 7; i++) {
      const found = rows.find(r => r.day_num === i);
      result.push({
        dayIndex: i,
        dayName: dayNames[i],
        totalSpent: found ? found.total_spent : 0,
        txCount: found ? found.tx_count : 0
      });
    }
    return result;
  },

  /**
   * Category Spending Drift & Month-over-Month Variance Analysis
   */
  getCategoryVariance(budgetId, currentMonth, previousMonth) {
    const rows = sqliteEngine.query(`
      SELECT 
        c.id, c.name, cg.name AS group_name,
        COALESCE(curr.spent, 0) AS current_spent,
        COALESCE(prev.spent, 0) AS previous_spent
      FROM categories c
      JOIN category_groups cg ON c.category_group_id = cg.id
      LEFT JOIN (
        SELECT category_id, SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS spent
        FROM transactions
        WHERE budget_id = ? AND deleted = 0 AND SUBSTR(date, 1, 7) = ?
        GROUP BY category_id
      ) curr ON c.id = curr.category_id
      LEFT JOIN (
        SELECT category_id, SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS spent
        FROM transactions
        WHERE budget_id = ? AND deleted = 0 AND SUBSTR(date, 1, 7) = ?
        GROUP BY category_id
      ) prev ON c.id = prev.category_id
      WHERE c.budget_id = ? AND c.deleted = 0 AND c.hidden = 0
        AND (COALESCE(curr.spent, 0) > 0 OR COALESCE(prev.spent, 0) > 0)
      ORDER BY (COALESCE(curr.spent, 0) - COALESCE(prev.spent, 0)) DESC;
    `, [budgetId, currentMonth, budgetId, previousMonth, budgetId]);

    return rows.map(r => {
      const diff = r.current_spent - r.previous_spent;
      const pctChange = r.previous_spent > 0 ? Math.round((diff / r.previous_spent) * 100) : (r.current_spent > 0 ? 100 : 0);
      return {
        id: r.id,
        name: r.name,
        groupName: r.group_name,
        currentSpent: r.current_spent,
        previousSpent: r.previous_spent,
        diff,
        pctChange
      };
    });
  }
};
