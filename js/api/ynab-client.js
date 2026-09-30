/**
 * Official YNAB REST API Client
 */
import { CONFIG } from '../config.js';
import { state } from '../state.js';

export class YnabClient {
  constructor() {
    this.baseUrl = CONFIG.YNAB_API_BASE;
  }

  /**
   * Internal request handler with rate limit header parsing and CORS detection
   */
  async request(endpoint, token = null) {
    const pat = token || state.get('apiToken');
    if (!pat) {
      throw new Error('No YNAB Personal Access Token provided.');
    }

    let url = `${this.baseUrl}${endpoint}`;
    
    // Optional CORS proxy bridge if enabled by user
    if (state.get('corsProxyEnabled') && !url.includes('corsproxy.io')) {
      url = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    }

    let response;
    try {
      response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${pat}`,
          'Accept': 'application/json'
        }
      });
    } catch (err) {
      // Check for CORS / file:// origin block
      if (window.location.protocol === 'file:') {
        throw new Error('CORS blocked due to file:// protocol. Please run via a local server (e.g. `npx serve .` or `python3 -m http.server`) or enable the CORS Proxy bridge in Settings.');
      }
      throw new Error(`Network error communicating with YNAB API: ${err.message}`);
    }

    // Parse rate limit header e.g. "45/200"
    const rateLimitHeader = response.headers.get('x-rate-limit');
    if (rateLimitHeader) {
      const parts = rateLimitHeader.split('/');
      if (parts.length === 2) {
        const used = parseInt(parts[0], 10);
        const total = parseInt(parts[1], 10);
        state.set('rateLimit', { used, total });
      }
    }

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errJson = await response.json();
        if (errJson.error && errJson.error.detail) {
          errorDetail = errJson.error.detail;
        }
      } catch (_) {}
      throw new Error(errorDetail);
    }

    const json = await response.json();
    return json.data;
  }

  /**
   * Validates the provided Personal Access Token by calling /user
   */
  async validateToken(token) {
    return await this.request('/user', token);
  }

  /**
   * Fetches list of all budgets accessible by the user
   */
  async getBudgets(token = null) {
    const data = await this.request('/budgets?include_accounts=true', token);
    return data.budgets;
  }

  /**
   * Fetches budget data with delta sync via last_knowledge_of_server
   */
  async getBudgetDelta(budgetId, lastKnowledgeOfServer = 0, token = null) {
    const endpoint = lastKnowledgeOfServer > 0
      ? `/budgets/${budgetId}?last_knowledge_of_server=${lastKnowledgeOfServer}`
      : `/budgets/${budgetId}`;
    
    const data = await this.request(endpoint, token);
    return {
      budget: data.budget,
      serverKnowledge: data.server_knowledge
    };
  }

  /**
   * Fetches official budget months list with delta sync
   */
  async getBudgetMonths(budgetId, lastKnowledgeOfServer = 0, token = null) {
    const endpoint = lastKnowledgeOfServer > 0
      ? `/budgets/${budgetId}/months?last_knowledge_of_server=${lastKnowledgeOfServer}`
      : `/budgets/${budgetId}/months`;
    
    const data = await this.request(endpoint, token);
    return {
      months: data.months,
      serverKnowledge: data.server_knowledge
    };
  }
}

export const ynabClient = new YnabClient();
