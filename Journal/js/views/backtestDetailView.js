/**
 * backtestDetailView.js
 * 单个 Backtest Book 详情视图：
 * 享受同样的 10 秒 Quick Trade 录入与 30 秒一键复盘抽屉体验，数据物理完全隔离。
 */

import { BacktestRepo } from '../db/backtestRepo.js';
import { aggregateMetrics } from '../core/calculations.js';
import { MetricCards } from '../components/metricCards.js';
import { TradeTable } from '../components/tradeTable.js';
import { TradeModal } from '../components/tradeModal.js';
import { TradeDrawer } from '../components/tradeDrawer.js';

export class BacktestDetailView {
  constructor(options = {}) {
    this.container = options.container;
    this.bookId = options.bookId;
    this.onBack = options.onBack || (() => {});
    this.book = null;
    this.trades = [];
    this.screenshotsMap = {};
    this.unit = '$';
  }

  async render() {
    this.book = await BacktestRepo.getBookById(this.bookId);
    if (!this.book) {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">Book Not Found</div>
          <button class="btn btn-primary" id="btn-back-books">Return to Books</button>
        </div>
      `;
      this.container.querySelector('#btn-back-books').addEventListener('click', () => this.onBack());
      return;
    }

    this.container.innerHTML = `
      <div class="backtest-mode-banner">
        <div>
          Backtest Book: <strong>${this.book.name}</strong>
        </div>
        <button class="btn btn-sm" id="btn-back-to-books" style="background:#FDE68A; border-color:#F59E0B; color:#92400E;">
          ← Back to Books
        </button>
      </div>

      <div class="view-header">
        <div class="header-left">
          <div>
            <div class="view-title">${this.book.name}</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
              ${this.book.symbol || 'Any'} • ${this.book.timeframe || 'Any TF'} • ${this.book.strategy || 'General Strategy'}
            </div>
          </div>
        </div>
        <div class="header-right">
          <div class="unit-toggle-group">
            <button class="unit-btn ${this.unit === '$' ? 'active' : ''}" data-unit="$">$</button>
            <button class="unit-btn ${this.unit === 'R' ? 'active' : ''}" data-unit="R">R</button>
            <button class="unit-btn ${this.unit === '%' ? 'active' : ''}" data-unit="%">%</button>
          </div>

          <button class="btn btn-danger btn-sm" id="btn-delete-book" style="margin-left: 6px;">Delete Book</button>
          
          <button class="btn btn-primary" id="btn-add-bt-trade" style="font-weight: 700;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            + Quick Trade (10s)
          </button>
        </div>
      </div>

      <div class="view-content" id="bt-detail-content">
        <div id="bt-kpi-container" style="margin-bottom: 12px;"></div>
        <div id="bt-trades-table-container"></div>
      </div>
    `;

    this.container.querySelector('#btn-back-to-books').addEventListener('click', () => this.onBack());
    
    this.container.querySelectorAll('.unit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.unit = btn.dataset.unit;
        this.refreshKPI();
      });
    });

    this.container.querySelector('#btn-add-bt-trade').addEventListener('click', () => {
      this.openAddModal();
    });

    this.container.querySelector('#btn-delete-book').addEventListener('click', async () => {
      if (confirm(`Delete Backtest Book "${this.book.name}"?\n\nThis will permanently remove the book and all its ${this.trades.length} backtest trades.`)) {
        await BacktestRepo.deleteBook(this.bookId);
        this.onBack();
      }
    });

    await this.loadData();
  }

  async loadData() {
    this.trades = await BacktestRepo.getTradesByBookId(this.bookId);

    this.screenshotsMap = {};
    for (const t of this.trades) {
      const screens = await BacktestRepo.getScreenshotsByTradeId(t.id);
      this.screenshotsMap[t.id] = screens.length;
    }

    this.refreshKPI();
    this.renderTable();
  }

  refreshKPI() {
    const metrics = aggregateMetrics(this.trades, this.book.initial_balance || 10000);
    const kpiHost = this.container.querySelector('#bt-kpi-container');
    if (kpiHost) {
      new MetricCards({
        container: kpiHost,
        metrics,
        unit: this.unit,
        accountBalance: this.book.initial_balance || 10000
      });
    }
  }

  renderTable() {
    const tableHost = this.container.querySelector('#bt-trades-table-container');
    if (!tableHost) return;

    if (this.trades.length === 0) {
      tableHost.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 28px; opacity: 0.6;">🎯</div>
          <div class="empty-state-title">No backtest trades in this book</div>
          <div class="empty-state-desc">Record historical test trades to calculate your win rate, expectancy, and R metrics for this setup.</div>
          <button class="btn btn-primary" id="empty-add-bt-btn">+ Quick Trade (10s)</button>
        </div>
      `;
      tableHost.querySelector('#empty-add-bt-btn').addEventListener('click', () => this.openAddModal());
      return;
    }

    new TradeTable({
      container: tableHost,
      trades: this.trades,
      screenshotsMap: this.screenshotsMap,
      onRowClick: (trade, opts) => this.openDetailDrawer(trade, opts)
    });
  }

  openAddModal(existingTrade = null, existingScreenshots = []) {
    new TradeModal({
      mode: 'BACKTEST',
      bookId: this.bookId,
      trade: existingTrade,
      screenshots: existingScreenshots,
      onSave: async (tradeData, pendingScreenshots) => {
        const saved = await BacktestRepo.saveTrade(tradeData);

        for (let i = 0; i < pendingScreenshots.length; i++) {
          const item = pendingScreenshots[i];
          if (!item.trade_id) {
            await BacktestRepo.saveScreenshot({
              ...item,
              trade_id: saved.id,
              display_order: i
            });
          }
        }

        await this.loadData();
      }
    });
  }

  async openDetailDrawer(trade, options = {}) {
    const screens = await BacktestRepo.getScreenshotsByTradeId(trade.id);
    new TradeDrawer({
      trade,
      screenshots: screens,
      mode: 'BACKTEST',
      focusClose: options.focusClose || false,
      onUpdated: async () => {
        await this.loadData();
      },
      onDelete: async (tradeId) => {
        await BacktestRepo.deleteTrade(tradeId);
        await this.loadData();
      }
    });
  }
}
