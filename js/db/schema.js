/**
 * SQLite DDL Schema, Indices, and Analytical Views
 */

export const SCHEMA_SQL = `
-- Meta information for synchronization and budget properties
CREATE TABLE IF NOT EXISTS sync_meta (
    budget_id TEXT PRIMARY KEY,
    server_knowledge INTEGER NOT NULL DEFAULT 0,
    last_synced_at TEXT NOT NULL,
    currency_format TEXT,
    currency_symbol TEXT DEFAULT '$',
    currency_decimal_digits INTEGER DEFAULT 2
);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    last_modified_on TEXT,
    first_month TEXT,
    last_month TEXT
);

-- Official YNAB Months table
CREATE TABLE IF NOT EXISTS months (
    month TEXT NOT NULL,             -- YYYY-MM
    budget_id TEXT NOT NULL,
    income INTEGER NOT NULL DEFAULT 0,
    budgeted INTEGER NOT NULL DEFAULT 0,
    activity INTEGER NOT NULL DEFAULT 0,
    to_be_budgeted INTEGER NOT NULL DEFAULT 0, -- Ready to Assign
    age_of_money INTEGER DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(month, budget_id),
    FOREIGN KEY(budget_id) REFERENCES budgets(id)
);
CREATE INDEX IF NOT EXISTS idx_months_lookup ON months(budget_id, month);

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    on_budget INTEGER NOT NULL DEFAULT 1,
    closed INTEGER NOT NULL DEFAULT 0,
    balance INTEGER NOT NULL DEFAULT 0,
    cleared_balance INTEGER NOT NULL DEFAULT 0,
    uncleared_balance INTEGER NOT NULL DEFAULT 0,
    last_reconciled_at TEXT,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(budget_id) REFERENCES budgets(id)
);

-- Category Groups
CREATE TABLE IF NOT EXISTS category_groups (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    name TEXT NOT NULL,
    hidden INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(budget_id) REFERENCES budgets(id)
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    category_group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    hidden INTEGER NOT NULL DEFAULT 0,
    budgeted INTEGER NOT NULL DEFAULT 0,
    activity INTEGER NOT NULL DEFAULT 0,
    balance INTEGER NOT NULL DEFAULT 0,
    goal_type TEXT,
    goal_target INTEGER DEFAULT 0,
    goal_target_month TEXT,
    goal_percentage_complete INTEGER DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(category_group_id) REFERENCES category_groups(id)
);

-- Payees
CREATE TABLE IF NOT EXISTS payees (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    name TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(budget_id) REFERENCES budgets(id)
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    date TEXT NOT NULL,
    amount INTEGER NOT NULL,
    memo TEXT,
    cleared TEXT NOT NULL DEFAULT 'uncleared',
    approved INTEGER NOT NULL DEFAULT 1,
    flag_color TEXT,
    account_id TEXT NOT NULL,
    payee_id TEXT,
    category_id TEXT,
    transfer_account_id TEXT,
    deleted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(account_id) REFERENCES accounts(id),
    FOREIGN KEY(payee_id) REFERENCES payees(id),
    FOREIGN KEY(category_id) REFERENCES categories(id)
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_trans_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_trans_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_trans_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_trans_payee ON transactions(payee_id);
CREATE INDEX IF NOT EXISTS idx_trans_deleted ON transactions(deleted);
CREATE INDEX IF NOT EXISTS idx_cat_group ON categories(category_group_id);

-- User-Friendly Human-Readable View for SQL Console & Analytics
CREATE VIEW IF NOT EXISTS v_transactions_readable AS
SELECT 
    t.id,
    t.date,
    ROUND(t.amount / 1000.0, 2) AS amount_dollars,
    t.amount AS amount_milliunits,
    a.name AS account_name,
    a.type AS account_type,
    COALESCE(p.name, 'No Payee') AS payee_name,
    COALESCE(c.name, 'Uncategorized') AS category_name,
    COALESCE(cg.name, 'No Group') AS category_group_name,
    t.memo,
    t.cleared,
    CASE WHEN t.approved = 1 THEN 'Yes' ELSE 'No' END AS approved,
    t.flag_color
FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.id
LEFT JOIN payees p ON t.payee_id = p.id
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN category_groups cg ON c.category_group_id = cg.id
WHERE t.deleted = 0;

-- Monthly Aggregation View
CREATE VIEW IF NOT EXISTS v_monthly_summary AS
SELECT
    SUBSTR(t.date, 1, 7) AS month,
    SUM(CASE 
        WHEN t.amount > 0 AND c.name LIKE 'Inflow%' AND t.transfer_account_id IS NULL AND a.on_budget = 1 
        THEN t.amount 
        ELSE 0 
    END) AS total_income,
    SUM(CASE 
        WHEN t.amount < 0 AND c.id IS NOT NULL AND c.name NOT LIKE 'Inflow%' AND t.transfer_account_id IS NULL AND a.on_budget = 1 
        THEN -t.amount 
        WHEN t.amount > 0 AND c.id IS NOT NULL AND c.name NOT LIKE 'Inflow%' AND t.transfer_account_id IS NULL AND a.on_budget = 1
        THEN -t.amount
        ELSE 0 
    END) AS total_expense,
    COUNT(t.id) AS transaction_count
FROM transactions t
JOIN accounts a ON t.account_id = a.id
LEFT JOIN categories c ON t.category_id = c.id
WHERE t.deleted = 0
GROUP BY SUBSTR(t.date, 1, 7)
ORDER BY month DESC;
`;

/**
 * Initializes schema on the current database
 */
export function initSchema(sqliteEngine) {
  sqliteEngine.exec(SCHEMA_SQL);
}
