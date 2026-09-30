/**
 * Delta Sync Engine with YNAB `server_knowledge` & In-Browser SQLite Upserts
 */
import { ynabClient } from './ynab-client.js';
import { sqliteEngine } from '../db/sqlite-wasm.js';
import { state } from '../state.js';

export const SyncEngine = {
  /**
   * Syncs the active budget with YNAB API via delta sync (server_knowledge).
   */
  async syncBudget(budgetId, forceFull = false) {
    const token = state.get('apiToken');
    if (!token) {
      throw new Error('Please enter your YNAB Personal Access Token in Settings.');
    }

    state.set('syncStatus', 'syncing');

    try {
      // 1. Get current server_knowledge from sync_meta unless forceFull
      let lastKnowledge = 0;
      if (!forceFull) {
        const metaRow = sqliteEngine.query(
          'SELECT server_knowledge FROM sync_meta WHERE budget_id = ?;',
          [budgetId]
        )[0];
        if (metaRow && metaRow.server_knowledge) {
          lastKnowledge = metaRow.server_knowledge;
        }
      }

      console.log(`[SyncEngine] Requesting delta sync for budget ${budgetId} with lastKnowledge=${lastKnowledge}`);
      const { budget, serverKnowledge } = await ynabClient.getBudgetDelta(budgetId, lastKnowledge, token);

      // Fetch official months directly to guarantee authoritative to_be_budgeted (Ready to Assign)
      let monthsList = budget.months || [];
      try {
        const monthsData = await ynabClient.getBudgetMonths(budgetId, lastKnowledge, token);
        if (monthsData && monthsData.months && monthsData.months.length > 0) {
          monthsList = monthsData.months;
        }
      } catch (err) {
        console.warn('[SyncEngine] Optional months endpoint fetch:', err.message);
      }

      // 2. Perform SQLite Upserts
      sqliteEngine.exec('BEGIN TRANSACTION;');

      try {
        // Upsert budget record
        sqliteEngine.run(`
          INSERT OR REPLACE INTO budgets (id, name, last_modified_on, first_month, last_month)
          VALUES (?, ?, ?, ?, ?);
        `, [
          budget.id,
          budget.name,
          budget.last_modified_on || new Date().toISOString(),
          budget.first_month || null,
          budget.last_month || null
        ]);

        // Currency format info
        const currencyFormat = budget.currency_format || {};
        const currencySymbol = currencyFormat.currency_symbol || '$';
        const decimalDigits = currencyFormat.decimal_digits ?? 2;

        // Upsert months
        if (monthsList && monthsList.length > 0) {
          for (const m of monthsList) {
            const monthStr = m.month ? m.month.substring(0, 7) : null;
            if (monthStr) {
              const readyToAssign = m.to_be_budgeted !== undefined ? m.to_be_budgeted : (m.ready_to_assign || 0);
              sqliteEngine.run(`
                INSERT OR REPLACE INTO months (
                  month, budget_id, income, budgeted, activity, to_be_budgeted, age_of_money, deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
              `, [
                monthStr,
                budget.id,
                m.income || 0,
                m.budgeted || 0,
                m.activity || 0,
                readyToAssign,
                m.age_of_money || 0,
                m.deleted ? 1 : 0
              ]);
            }
          }
        }

        // Upsert accounts
        if (budget.accounts && budget.accounts.length > 0) {
          for (const acc of budget.accounts) {
            sqliteEngine.run(`
              INSERT OR REPLACE INTO accounts (id, budget_id, name, type, on_budget, closed, balance, cleared_balance, uncleared_balance, last_reconciled_at, deleted)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `, [
              acc.id,
              budget.id,
              acc.name,
              acc.type,
              acc.on_budget ? 1 : 0,
              acc.closed ? 1 : 0,
              acc.balance,
              acc.cleared_balance,
              acc.uncleared_balance,
              acc.last_reconciled_at || null,
              acc.deleted ? 1 : 0
            ]);
          }
        }

        // Upsert category groups
        if (budget.category_groups && budget.category_groups.length > 0) {
          for (const cg of budget.category_groups) {
            sqliteEngine.run(`
              INSERT OR REPLACE INTO category_groups (id, budget_id, name, hidden, deleted)
              VALUES (?, ?, ?, ?, ?);
            `, [
              cg.id,
              budget.id,
              cg.name,
              cg.hidden ? 1 : 0,
              cg.deleted ? 1 : 0
            ]);
          }
        }

        // Upsert categories
        if (budget.categories && budget.categories.length > 0) {
          for (const c of budget.categories) {
            sqliteEngine.run(`
              INSERT OR REPLACE INTO categories (
                id, budget_id, category_group_id, name, hidden,
                budgeted, activity, balance, goal_type, goal_target,
                goal_target_month, goal_percentage_complete, deleted
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `, [
              c.id,
              budget.id,
              c.category_group_id,
              c.name,
              c.hidden ? 1 : 0,
              c.budgeted || 0,
              c.activity || 0,
              c.balance || 0,
              c.goal_type || null,
              c.goal_target || 0,
              c.goal_target_month || null,
              c.goal_percentage_complete || 0,
              c.deleted ? 1 : 0
            ]);
          }
        }

        // Upsert payees
        if (budget.payees && budget.payees.length > 0) {
          for (const p of budget.payees) {
            sqliteEngine.run(`
              INSERT OR REPLACE INTO payees (id, budget_id, name, deleted)
              VALUES (?, ?, ?, ?);
            `, [
              p.id,
              budget.id,
              p.name,
              p.deleted ? 1 : 0
            ]);
          }
        }

        // Upsert transactions
        if (budget.transactions && budget.transactions.length > 0) {
          for (const t of budget.transactions) {
            sqliteEngine.run(`
              INSERT OR REPLACE INTO transactions (
                id, budget_id, date, amount, memo, cleared, approved, flag_color,
                account_id, payee_id, category_id, transfer_account_id, deleted
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `, [
              t.id,
              budget.id,
              t.date,
              t.amount,
              t.memo || null,
              t.cleared || 'uncleared',
              t.approved ? 1 : 0,
              t.flag_color || null,
              t.account_id,
              t.payee_id || null,
              t.category_id || null,
              t.transfer_account_id || null,
              t.deleted ? 1 : 0
            ]);
          }
        }

        // Update sync_meta
        sqliteEngine.run(`
          INSERT OR REPLACE INTO sync_meta (budget_id, server_knowledge, last_synced_at, currency_symbol, currency_decimal_digits)
          VALUES (?, ?, datetime('now'), ?, ?);
        `, [
          budget.id,
          serverKnowledge,
          currencySymbol,
          decimalDigits
        ]);

        sqliteEngine.exec('COMMIT;');
      } catch (txErr) {
        sqliteEngine.exec('ROLLBACK;');
        throw txErr;
      }

      // Persist binary SQLite db to IndexedDB
      await sqliteEngine.persist();

      state.set('serverKnowledge', serverKnowledge);
      state.set('lastSyncTime', new Date().toLocaleTimeString());
      state.set('syncStatus', 'idle');

      console.log(`[SyncEngine] Sync complete for ${budgetId}. Server knowledge now at ${serverKnowledge}`);
      return { success: true, serverKnowledge };
    } catch (err) {
      state.set('syncStatus', 'error');
      console.error('[SyncEngine] Sync error:', err);
      throw err;
    }
  }
};
