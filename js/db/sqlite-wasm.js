/**
 * In-Browser SQLite WebAssembly Engine & IndexedDB Persistence
 */
import { CONFIG } from '../config.js';

class SQLiteEngine {
  constructor() {
    this.SQL = null;
    this.db = null;
    this.currentBudgetId = null;
    this.initialized = false;
  }

  /**
   * Initializes the SQL.js WebAssembly environment
   */
  async init() {
    if (this.initialized) return;

    if (!window.initSqlJs) {
      await this.loadScript(CONFIG.SQL_WASM.JS);
    }

    this.SQL = await window.initSqlJs({
      locateFile: file => {
        if (file.endsWith('.wasm')) {
          return CONFIG.SQL_WASM.WASM;
        }
        return file;
      }
    });

    this.initialized = true;
  }

  isInitialized() {
    return this.db !== null;
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Opens or creates a SQLite database for a specific budget,
   * restoring from IndexedDB binary cache if available.
   */
  async openDatabase(budgetId) {
    await this.init();
    this.currentBudgetId = budgetId;

    // Check if we have an existing database snapshot in IndexedDB
    const binaryData = await this.loadFromIndexedDB(budgetId);
    if (binaryData && binaryData.length > 0) {
      try {
        this.db = new this.SQL.Database(binaryData);
        console.log(`[SQLite WASM] Restored database for ${budgetId} from IndexedDB (${binaryData.length} bytes)`);
        return this.db;
      } catch (err) {
        console.warn('[SQLite WASM] Corrupted DB in IndexedDB, creating fresh DB:', err);
      }
    }

    // Create fresh DB
    this.db = new this.SQL.Database();
    console.log(`[SQLite WASM] Created fresh in-memory database for ${budgetId}`);
    return this.db;
  }

  /**
   * Executes a SQL statement (DDL/DML)
   */
  exec(sql) {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.exec(sql);
  }

  /**
   * Runs a SQL SELECT query with optional parameters and returns an array of objects
   */
  query(sql, params = []) {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  /**
   * Executes a parameterized query (INSERT, UPDATE, DELETE)
   */
  run(sql, params = []) {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(sql, params);
  }

  /**
   * Exports the SQLite database to a Uint8Array
   */
  exportBinary() {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.export();
  }

  /**
   * Persists the current database binary to IndexedDB
   */
  async persist() {
    if (!this.db || !this.currentBudgetId) return;
    const binary = this.exportBinary();
    await this.saveToIndexedDB(this.currentBudgetId, binary);
    console.log(`[SQLite WASM] Persisted ${binary.length} bytes to IndexedDB for budget ${this.currentBudgetId}`);
  }

  // --- IndexedDB Storage Adapter ---

  getIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CONFIG.DB.NAME, CONFIG.DB.VERSION);
      request.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(CONFIG.DB.STORE_NAME)) {
          db.createObjectStore(CONFIG.DB.STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveToIndexedDB(budgetId, binaryData) {
    const idb = await this.getIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(CONFIG.DB.STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.DB.STORE_NAME);
      const req = store.put(binaryData, `${CONFIG.DB.KEY_PREFIX}${budgetId}`);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async loadFromIndexedDB(budgetId) {
    const idb = await this.getIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(CONFIG.DB.STORE_NAME, 'readonly');
      const store = tx.objectStore(CONFIG.DB.STORE_NAME);
      const req = store.get(`${CONFIG.DB.KEY_PREFIX}${budgetId}`);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteFromIndexedDB(budgetId) {
    const idb = await this.getIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(CONFIG.DB.STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.DB.STORE_NAME);
      const req = store.delete(`${CONFIG.DB.KEY_PREFIX}${budgetId}`);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const sqliteEngine = new SQLiteEngine();
