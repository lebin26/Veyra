/**
 * sidebar.js
 * 侧边栏导航组件（完全对齐 VEYRA 系统规范与最新 PRD 架构）：
 * 包含：
 * - 顶部核心行动按钮：+ Add Trade (Purple / Brand Accent)
 * - MAIN (Dashboard, Daily Journal, Trades, Notebook, Progress Tracker [NEW])
 * - STRATEGY (Playbook, Reports)
 * - TOOLS (Backtesting, Mentor Mode, Settings)
 * - APPLICATIONS (Calculator, Wealth, Portal)
 * 严格剔除：Trade Replay, University, Resource Center (NO NEED)
 */

export class Sidebar {
  constructor(options = {}) {
    this.container = options.container;
    this.currentRoute = options.currentRoute || 'live-dashboard';
    this.onNavigate = options.onNavigate || (() => {});
    this.onAddTrade = options.onAddTrade || (() => {});
    this.onToggleTheme = options.onToggleTheme || (() => {});
    this.currentTheme = options.currentTheme || 'light';
    this.init();
  }

  setTheme(theme) {
    this.currentTheme = theme;
    const themeBtn = this.container ? this.container.querySelector('#sidebar-theme-toggle') : null;
    if (themeBtn) {
      themeBtn.innerHTML = this.getThemeIconSvg();
      themeBtn.setAttribute('title', theme === 'dark' ? 'Switch to light theme (T)' : 'Switch to dark theme (T)');
      themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
  }

  getThemeIconSvg() {
    return this.currentTheme === 'dark'
      ? `<svg class="theme-icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
      : `<svg class="theme-icon-svg" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
  }

  setRoute(route) {
    this.currentRoute = route;
    this.render();
  }

  init() {
    this.render();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="sidebar-header">
        <a href="../main-page/index.html" class="sidebar-brand" title="Veyra Applications Portal">
          <span class="brand-logo-mark"></span>
          <span class="sidebar-brand-name">Veyra</span>
        </a>
        <span class="sidebar-app-tag">Journal</span>
      </div>

      <!-- Top Primary Action Button: + Add Trade -->
      <div style="padding: 10px 14px 4px;">
        <button type="button" class="btn-sidebar-add-trade" id="btn-sidebar-add-trade" title="Add Trade (File Upload, Broker Sync, Manual)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"></path></svg>
          <span>Add Trade</span>
        </button>
      </div>

      <nav class="sidebar-nav">
        <!-- MAIN -->
        <div class="sidebar-group-label">MAIN</div>
        <button type="button" class="sidebar-nav-item ${this.currentRoute === 'live-dashboard' ? 'active' : ''}" data-route="live-dashboard" title="Trading Performance Dashboard">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="9"></rect>
            <rect x="14" y="3" width="7" height="5"></rect>
            <rect x="14" y="12" width="7" height="9"></rect>
            <rect x="3" y="16" width="7" height="5"></rect>
          </svg>
          <span>Dashboard</span>
          <kbd class="sidebar-shortcut-tag">D</kbd>
        </button>

        <button type="button" class="sidebar-nav-item ${this.currentRoute === 'daily-journal' ? 'active' : ''}" data-route="daily-journal" title="Daily Trading Journal & Review">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>Daily Journal</span>
          <kbd class="sidebar-shortcut-tag">J</kbd>
        </button>

        <button type="button" class="sidebar-nav-item ${this.currentRoute === 'live-journal' ? 'active' : ''}" data-route="live-journal" title="Trades Execution Log">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          <span>Trades</span>
          <kbd class="sidebar-shortcut-tag">T</kbd>
        </button>

        <button type="button" class="sidebar-nav-item ${this.currentRoute === 'notebook' ? 'active' : ''}" data-route="notebook" title="Trading Notebook & Psychology">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span>Notebook</span>
          <kbd class="sidebar-shortcut-tag">N</kbd>
        </button>

        <button type="button" class="sidebar-nav-item ${this.currentRoute === 'progress-tracker' ? 'active' : ''}" data-route="progress-tracker" title="Progress Tracker & Milestones">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <span>Progress Tracker</span>
          <span class="nav-badge-new">NEW</span>
        </button>

        <!-- STRATEGY -->
        <div class="sidebar-group-label" style="margin-top:12px;">STRATEGY</div>
        <button type="button" class="sidebar-nav-item ${this.currentRoute === 'playbook' || this.currentRoute === 'strategies' ? 'active' : ''}" data-route="playbook" title="Execution Playbooks & Rulebook">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
          <span>Playbook</span>
          <kbd class="sidebar-shortcut-tag">B</kbd>
        </button>

        <button type="button" class="sidebar-nav-item ${this.currentRoute === 'reports' || this.currentRoute === 'analytics' ? 'active' : ''}" data-route="reports" title="Comprehensive Quantitative Reports">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
          </svg>
          <span>Reports</span>
          <kbd class="sidebar-shortcut-tag">R</kbd>
        </button>

        <!-- TOOLS -->
        <div class="sidebar-group-label" style="margin-top:12px;">TOOLS</div>
        <button type="button" class="sidebar-nav-item ${this.currentRoute === 'backtest-books' || this.currentRoute === 'backtest-detail' || this.currentRoute === 'backtest-overview' || this.currentRoute === 'live-vs-backtest' ? 'active' : ''}" data-route="backtest-books" title="Backtest Playbooks">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          <span>Backtesting</span>
        </button>

        <button type="button" class="sidebar-nav-item ${this.currentRoute === 'mentor-mode' ? 'active' : ''}" data-route="mentor-mode" title="Mentor Mode Discipline Audit">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>Mentor Mode</span>
        </button>

        <button type="button" class="sidebar-nav-item ${this.currentRoute === 'settings' ? 'active' : ''}" data-route="settings" title="Settings & Local Backup">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>Settings</span>
        </button>

        <!-- APPLICATIONS -->
        <div class="sidebar-group-label" style="margin-top:14px;">APPLICATIONS</div>
        <a href="../calculator/index.html" class="sidebar-nav-link" title="Position Size Calculator (1)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="18"></line><path d="M16 10h.01"></path><path d="M12 10h.01"></path><path d="M8 10h.01"></path><path d="M12 14h.01"></path><path d="M8 14h.01"></path><path d="M12 18h.01"></path><path d="M8 18h.01"></path></svg>
          <span>Calculator</span>
          <kbd class="sidebar-shortcut-tag">1</kbd>
        </a>
        <a href="../wealth/index.html" class="sidebar-nav-link" title="Wealth Portfolio Tracker (3)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
          <span>Wealth</span>
          <kbd class="sidebar-shortcut-tag">3</kbd>
        </a>
        <a href="../main-page/index.html" class="sidebar-nav-link" title="Back to Applications Portal">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          <span>Portal</span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-status-pill" title="Private Local IndexedDB Storage">
          <span class="sidebar-status-dot"></span>
          <span>IndexedDB</span>
        </div>
        <button type="button" id="sidebar-theme-toggle" class="theme-ghost-btn" aria-label="Toggle theme" title="Toggle theme (T)">
          ${this.getThemeIconSvg()}
        </button>
      </div>
    `;

    const addBtn = this.container.querySelector('#btn-sidebar-add-trade');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.onAddTrade();
      });
    }

    this.container.querySelectorAll('[data-route]').forEach(item => {
      item.addEventListener('click', () => {
        const route = item.dataset.route;
        this.onNavigate(route);
      });
    });

    const themeBtn = this.container.querySelector('#sidebar-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        this.onToggleTheme();
      });
    }
  }
}
