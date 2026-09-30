/**
 * Reactive State Management Store
 */
import { CONFIG } from './config.js';

class StateStore {
  constructor() {
    this.listeners = new Map();
    
    // Load initial values from localStorage if available
    const savedToken = localStorage.getItem(CONFIG.STORAGE_KEYS.API_TOKEN) || '';
    const savedBudgetId = localStorage.getItem(CONFIG.STORAGE_KEYS.SELECTED_BUDGET_ID) || '';
    const savedTheme = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME) || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const savedCorsProxy = localStorage.getItem(CONFIG.STORAGE_KEYS.CORS_PROXY) === 'true';

    this.state = {
      apiToken: savedToken,
      selectedBudgetId: savedBudgetId,
      budgetsList: [],
      currentBudgetMeta: null,
      currentView: 'executive',
      theme: savedTheme,
      syncStatus: 'idle', // 'idle' | 'syncing' | 'error' | 'success'
      lastSyncTime: null,
      serverKnowledge: 0,
      rateLimit: {
        used: 0,
        total: CONFIG.RATE_LIMIT.MAX_REQUESTS,
        resetTime: null
      },
      corsProxyEnabled: savedCorsProxy,
      selectedTimeframe: 'current', // 'current' | 'last_month' | 'last_3m' | 'last_6m' | 'last_12m' | 'ytd' | 'all' | 'YYYY-MM'
      dateRange: {
        start: null,
        end: null
      }
    };
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    if (this.state[key] === value) return;
    const oldValue = this.state[key];
    this.state[key] = value;

    // Sync persistent keys to localStorage
    if (key === 'apiToken') {
      if (value) localStorage.setItem(CONFIG.STORAGE_KEYS.API_TOKEN, value);
      else localStorage.removeItem(CONFIG.STORAGE_KEYS.API_TOKEN);
    } else if (key === 'selectedBudgetId') {
      if (value) localStorage.setItem(CONFIG.STORAGE_KEYS.SELECTED_BUDGET_ID, value);
      else localStorage.removeItem(CONFIG.STORAGE_KEYS.SELECTED_BUDGET_ID);
    } else if (key === 'theme') {
      localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, value);
    } else if (key === 'corsProxyEnabled') {
      localStorage.setItem(CONFIG.STORAGE_KEYS.CORS_PROXY, String(value));
    }

    this.notify(key, value, oldValue);
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => this.listeners.get(key).delete(callback);
  }

  notify(key, newValue, oldValue) {
    if (this.listeners.has(key)) {
      for (const callback of this.listeners.get(key)) {
        try {
          callback(newValue, oldValue);
        } catch (e) {
          console.error(`Error in state listener for "${key}":`, e);
        }
      }
    }
    // Also notify wildcard listeners
    if (this.listeners.has('*')) {
      for (const callback of this.listeners.get('*')) {
        try {
          callback(key, newValue, oldValue);
        } catch (e) {
          console.error('Error in wildcard state listener:', e);
        }
      }
    }
  }
}

export const state = new StateStore();
