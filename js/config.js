/**
 * Configuration & Constants
 */
export const CONFIG = {
  APP_NAME: 'YNAB Intelligence Suite',
  APP_VERSION: '1.0.0',
  YNAB_API_BASE: 'https://api.ynab.com/v1',
  
  // LocalStorage keys
  STORAGE_KEYS: {
    API_TOKEN: 'ynab_pat_token',
    SELECTED_BUDGET_ID: 'ynab_selected_budget_id',
    THEME: 'ynab_ui_theme',
    CORS_PROXY: 'ynab_cors_proxy',
  },
  
  // IndexedDB config for SQLite binary persistence
  DB: {
    NAME: 'ynab_intelligence_store',
    VERSION: 1,
    STORE_NAME: 'sqlite_snapshots',
    KEY_PREFIX: 'sqlite_db_',
  },
  
  // Rate limiting defaults (YNAB limit is 200 req/hr)
  RATE_LIMIT: {
    MAX_REQUESTS: 200,
    WARN_THRESHOLD: 160,
  },
  
  // Default lookback periods
  LOOKBACK_MONTHS: 12,
  
  // CDN URLs for SQLite wasm assets
  SQL_WASM: {
    JS: 'https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/sql-wasm.js',
    WASM: 'https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/sql-wasm.wasm'
  }
};
