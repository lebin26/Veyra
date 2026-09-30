/**
 * sidebar.js
 * 侧边栏导航组件（完全对齐 VEYRA 蒸馏架构）：
 * 包含：
 * - LIVE TRADING (Dashboard, Trades, Daily Journal)
 * - BACKTESTING (Backtest Books, Overview, Live vs Backtest)
 * - STRATEGY PLAYBOOK (Strategies & Rules)
 * - SYSTEM (Analytics Reports, Settings)
 */

export class Sidebar {
  constructor(options = {}) {
    this.container = options.container;
    this.currentRoute = options.currentRoute || 'live-dashboard';
    this.onNavigate = options.onNavigate || (() => {});
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
        <div class="sidebar-top-bar">
          <a href="../main-page/index.html" class="sidebar-back-btn" title="Back to Apps (Esc)" aria-label="Back to Apps">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            <span>Apps</span>
          </a>
          <button type="button" id="sidebar-theme-toggle" class="sidebar-theme-btn" title="${this.currentTheme === 'dark' ? 'Switch to light theme (T)' : 'Switch to dark theme (T)'}" aria-label="Toggle theme">
            ${this.getThemeIconSvg()}
          </button>
        </div>
        <div class="sidebar-brand-row">
          <div class="brand-title">
            <span class="brand-logo-mark"></span>
            <span>Trading Journal</span>
          </div>
          <span class="brand-badge">VEYRA</span>
        </div>
      </div>

      <div class="sidebar-nav">
        <!-- LIVE TRADING -->
        <div>
          <div class="nav-section-title">Live Trading</div>
          <ul class="nav-list">
            <li>
              <a class="nav-item ${this.currentRoute === 'live-dashboard' ? 'active' : ''}" data-route="live-dashboard">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                Dashboard
              </a>
            </li>
            <li>
              <a class="nav-item ${this.currentRoute === 'live-journal' ? 'active' : ''}" data-route="live-journal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                Trades
              </a>
            </li>
            <li>
              <a class="nav-item ${this.currentRoute === 'daily-journal' ? 'active' : ''}" data-route="daily-journal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Daily Journal
              </a>
            </li>
          </ul>
        </div>

        <!-- STRATEGIES / PLAYBOOKS -->
        <div>
          <div class="nav-section-title">Playbooks</div>
          <ul class="nav-list">
            <li>
              <a class="nav-item ${this.currentRoute === 'strategies' ? 'active' : ''}" data-route="strategies">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                  <polyline points="2 17 12 22 22 17"></polyline>
                  <polyline points="2 12 12 17 22 12"></polyline>
                </svg>
                Strategies & Rules
              </a>
            </li>
          </ul>
        </div>

        <!-- BACKTESTING -->
        <div>
          <div class="nav-section-title">Backtesting</div>
          <ul class="nav-list">
            <li>
              <a class="nav-item ${this.currentRoute === 'backtest-books' || this.currentRoute === 'backtest-detail' ? 'active' : ''}" data-route="backtest-books">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                Backtest Books
              </a>
            </li>
            <li>
              <a class="nav-item ${this.currentRoute === 'backtest-overview' ? 'active' : ''}" data-route="backtest-overview">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                Backtest Overview
              </a>
            </li>
            <li>
              <a class="nav-item ${this.currentRoute === 'live-vs-backtest' ? 'active' : ''}" data-route="live-vs-backtest">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="12" y1="3" x2="12" y2="21"></line>
                  <polyline points="8 8 4 12 8 16"></polyline>
                  <polyline points="16 8 20 12 16 16"></polyline>
                </svg>
                Live vs Backtest
              </a>
            </li>
          </ul>
        </div>

        <!-- SYSTEM & REPORTS -->
        <div>
          <div class="nav-section-title">Analytics & Tools</div>
          <ul class="nav-list">
            <li>
              <a class="nav-item ${this.currentRoute === 'analytics' ? 'active' : ''}" data-route="analytics">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
                </svg>
                Analytics Reports
              </a>
            </li>
            <li>
              <a class="nav-item ${this.currentRoute === 'settings' ? 'active' : ''}" data-route="settings">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                Settings & Backup
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div class="sidebar-footer">
        <span>Private Journal</span>
        <span style="font-family: var(--font-mono);">Local IndexedDB</span>
      </div>
    `;

    this.container.querySelectorAll('.nav-item').forEach(item => {
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
