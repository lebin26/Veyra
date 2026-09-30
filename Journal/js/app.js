/**
 * app.js
 * 主应用程序调度中心（全量集成 VEYRA 架构）：
 * 包含 Live Dashboard, Trades, Daily Journal, Strategies, Backtests, Live vs Backtest, Analytics, Settings.
 */

import { openDatabase } from './db/database.js';
import { Sidebar } from './components/sidebar.js';
import { requirePageAuth } from '../../js/auth/authGuard.js';
import { LiveDashboardView } from './views/liveDashboardView.js';
import { LiveJournalView } from './views/liveJournalView.js';
import { DailyJournalView } from './views/dailyJournalView.js';
import { StrategiesView } from './views/strategiesView.js';
import { BacktestBooksView } from './views/backtestBooksView.js';
import { BacktestDetailView } from './views/backtestDetailView.js';
import { BacktestOverviewView } from './views/backtestOverviewView.js';
import { LiveVsBacktestView } from './views/liveVsBacktestView.js';
import { AnalyticsView } from './views/analyticsView.js';
import { SettingsView } from './views/settingsView.js';

class TradingJournalApp {
  constructor() {
    this.currentRoute = 'live-dashboard';
    this.currentBookId = null;
    this.sidebar = null;
    this.mainContainer = document.getElementById('app-main-viewport');
    this.currentTheme = 'light';
  }

  applyTheme(theme) {
    this.currentTheme = theme;
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    if (this.sidebar) {
      this.sidebar.setTheme(theme);
    }
    try {
      localStorage.setItem('calc_theme', theme);
    } catch (e) {
      // ignore storage errors
    }
  }

  toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    this.applyTheme(isDark ? 'light' : 'dark');
  }

  setupShortcuts() {
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toUpperCase() : '';
      const isInputActive = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

      if (isInputActive) {
        if (e.key === 'Escape') {
          document.activeElement.blur();
        }
        return;
      }

      if (e.key === 'Escape') {
        window.location.href = '../main-page/index.html';
      } else if (e.key === '1') {
        window.location.href = '../calculator/index.html';
      } else if (e.key === 't' || e.key === 'T') {
        this.toggleTheme();
      }
    });

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        try {
          if (!localStorage.getItem('calc_theme')) {
            this.applyTheme(e.matches ? 'dark' : 'light');
          }
        } catch (err) {}
      });
    }
  }

  async init() {
    try {
      // Synchronize theme with Veyra unified theme state
      let initialTheme = 'light';
      try {
        const savedTheme = localStorage.getItem('calc_theme');
        if (savedTheme) {
          initialTheme = savedTheme;
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          initialTheme = 'dark';
        }
      } catch (e) {}
      this.applyTheme(initialTheme);

      // Verify authentication and entitlement for Trading Journal
      const authContext = await requirePageAuth({ appKey: 'trading_journal' });
      if (!authContext) return;

      await openDatabase();

      const sidebarContainer = document.getElementById('app-sidebar-host');
      this.sidebar = new Sidebar({
        container: sidebarContainer,
        currentRoute: this.currentRoute,
        currentTheme: this.currentTheme,
        onNavigate: (route) => this.navigate(route),
        onToggleTheme: () => this.toggleTheme()
      });

      this.setupShortcuts();

      await this.renderCurrentView();
    } catch (err) {
      console.error('Failed to initialize Trading Journal Application:', err);
      if (this.mainContainer) {
        this.mainContainer.innerHTML = `
          <div style="padding: 40px; color: var(--loss-color);">
            <h3>Initialization Error</h3>
            <p>${err.message}</p>
          </div>
        `;
      }
    }
  }

  async navigate(route, params = {}) {
    this.currentRoute = route;
    if (params.bookId) {
      this.currentBookId = params.bookId;
    }
    if (this.sidebar) {
      this.sidebar.setRoute(route);
    }
    await this.renderCurrentView();
  }

  async renderCurrentView() {
    this.mainContainer.innerHTML = '';

    switch (this.currentRoute) {
      case 'live-dashboard':
        new LiveDashboardView({
          container: this.mainContainer
        }).render();
        break;

      case 'live-journal':
        new LiveJournalView({
          container: this.mainContainer
        }).render();
        break;

      case 'daily-journal':
        new DailyJournalView({
          container: this.mainContainer
        }).render();
        break;

      case 'strategies':
        new StrategiesView({
          container: this.mainContainer
        }).render();
        break;

      case 'backtest-books':
        new BacktestBooksView({
          container: this.mainContainer,
          onSelectBook: (bookId) => {
            this.navigate('backtest-detail', { bookId });
          }
        }).render();
        break;

      case 'backtest-detail':
        new BacktestDetailView({
          container: this.mainContainer,
          bookId: this.currentBookId,
          onBack: () => {
            this.navigate('backtest-books');
          }
        }).render();
        break;

      case 'backtest-overview':
        new BacktestOverviewView({
          container: this.mainContainer
        }).render();
        break;

      case 'live-vs-backtest':
        new LiveVsBacktestView({
          container: this.mainContainer
        }).render();
        break;

      case 'analytics':
        new AnalyticsView({
          container: this.mainContainer
        }).render();
        break;

      case 'settings':
        new SettingsView({
          container: this.mainContainer,
          onAccountUpdated: () => {}
        }).render();
        break;

      default:
        this.currentRoute = 'live-dashboard';
        this.renderCurrentView();
        break;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new TradingJournalApp();
  app.init();
});
