/**
 * Authentication & API Key Management Modal / Drawer
 */
import { state } from '../../state.js';
import { ynabClient } from '../../api/ynab-client.js';
import { Toast } from './toast.js';

export const AuthModal = {
  init() {
    const modalEl = document.getElementById('auth-modal');
    if (!modalEl) return;

    const tokenInput = document.getElementById('api-token-input');
    const saveBtn = document.getElementById('save-token-btn');
    const closeBtn = document.getElementById('close-auth-modal-btn');
    const demoToggle = document.getElementById('demo-mode-toggle');
    const corsProxyToggle = document.getElementById('cors-proxy-toggle');
    const clearTokenBtn = document.getElementById('clear-token-btn');

    // Populate current values
    if (tokenInput) tokenInput.value = state.get('apiToken') || '';
    if (corsProxyToggle) corsProxyToggle.checked = state.get('corsProxyEnabled');

    // Rate limit display update
    const updateRateLimitDisplay = (rateLimit) => {
      const rlBadge = document.getElementById('rate-limit-badge');
      if (rlBadge && rateLimit) {
        rlBadge.textContent = `${rateLimit.used} / ${rateLimit.total} reqs`;
        if (rateLimit.used > 160) {
          rlBadge.className = 'px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20';
        } else {
          rlBadge.className = 'px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20';
        }
      }
    };
    state.subscribe('rateLimit', updateRateLimitDisplay);
    updateRateLimitDisplay(state.get('rateLimit'));

    // Save token action
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const token = tokenInput.value.trim();
        if (!token) {
          Toast.warning('Please enter a valid YNAB Personal Access Token.');
          return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Validating...`;
        if (window.lucide) window.lucide.createIcons();

        try {
          const user = await ynabClient.validateToken(token);
          state.set('apiToken', token);

          Toast.success(`Connected as YNAB user: ${user.user?.id || 'Active'}`);
          this.close();

          // Trigger budget list reload
          window.dispatchEvent(new CustomEvent('ynab:reload-budgets'));
        } catch (err) {
          Toast.error(`Authentication failed: ${err.message}`);
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `Save & Connect`;
          if (window.lucide) window.lucide.createIcons();
        }
      });
    }

    // Clear token
    if (clearTokenBtn) {
      clearTokenBtn.addEventListener('click', () => {
        state.set('apiToken', '');
        tokenInput.value = '';
        Toast.info('Personal Access Token removed.');
        window.dispatchEvent(new CustomEvent('ynab:reload-budgets'));
      });
    }

    // Toggle CORS proxy
    if (corsProxyToggle) {
      corsProxyToggle.addEventListener('change', (e) => {
        state.set('corsProxyEnabled', e.target.checked);
        Toast.info(`CORS Proxy Bridge ${e.target.checked ? 'Enabled' : 'Disabled'}`);
      });
    }

    // Close modal
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Close on backdrop click
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) this.close();
    });
  },

  open() {
    const modalEl = document.getElementById('auth-modal');
    if (modalEl) {
      modalEl.classList.remove('hidden');
      modalEl.classList.add('flex');
      if (window.lucide) window.lucide.createIcons();
    }
  },

  close() {
    const modalEl = document.getElementById('auth-modal');
    if (modalEl) {
      modalEl.classList.add('hidden');
      modalEl.classList.remove('flex');
    }
  }
};
