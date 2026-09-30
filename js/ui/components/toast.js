/**
 * Toast Notification System
 */

class ToastManager {
  constructor() {
    this.container = null;
  }

  getContainer() {
    if (!this.container) {
      this.container = document.getElementById('toast-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none';
        document.body.appendChild(this.container);
      }
    }
    return this.container;
  }

  show(message, type = 'info', duration = 4000) {
    const container = this.getContainer();
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center gap-3 p-4 rounded-xl shadow-lg border text-sm transition-all duration-300 transform translate-y-2 opacity-0 glass-panel`;

    let iconColor = 'text-blue-500';
    let iconName = 'info';

    if (type === 'success') {
      iconColor = 'text-emerald-500';
      iconName = 'check-circle-2';
    } else if (type === 'error') {
      iconColor = 'text-rose-500';
      iconName = 'alert-circle';
    } else if (type === 'warning') {
      iconColor = 'text-amber-500';
      iconName = 'alert-triangle';
    }

    toast.innerHTML = `
      <i data-lucide="${iconName}" class="w-5 h-5 shrink-0 ${iconColor}"></i>
      <div class="flex-1 font-medium text-slate-800 dark:text-slate-100">${message}</div>
      <button class="shrink-0 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    `;

    const closeBtn = toast.querySelector('button');
    closeBtn.addEventListener('click', () => this.dismiss(toast));

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons({ root: toast });

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    // Auto dismiss
    const timeout = setTimeout(() => {
      this.dismiss(toast);
    }, duration);

    toast._timeout = timeout;
  }

  dismiss(toast) {
    if (toast._dismissed) return;
    toast._dismissed = true;
    clearTimeout(toast._timeout);

    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-2', 'opacity-0');

    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  }

  success(msg, dur) { this.show(msg, 'success', dur); }
  error(msg, dur) { this.show(msg, 'error', dur); }
  info(msg, dur) { this.show(msg, 'info', dur); }
  warning(msg, dur) { this.show(msg, 'warning', dur); }
}

export const Toast = new ToastManager();
