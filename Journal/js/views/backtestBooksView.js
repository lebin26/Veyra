/**
 * backtestBooksView.js
 * Backtest 模块首页：展示全部 Backtest Books，并提供新建 Book 功能。
 * 顶部显示显眼的 "BACKTEST MODE" 警示，保证操作心智清晰。
 */

import { BacktestRepo } from '../db/backtestRepo.js';
import { aggregateMetrics } from '../core/calculations.js';
import { formatCurrency, formatR, getMetricColorClass } from '../core/formatters.js';

export class BacktestBooksView {
  constructor(options = {}) {
    this.container = options.container;
    this.books = [];
    this.onSelectBook = options.onSelectBook || (() => {});
  }

  async render() {
    this.container.innerHTML = `
      <div class="backtest-mode-banner">
        <div>
          Backtest Workspace — All data in this section is completely isolated from Live Trading.
        </div>
        <div style="font-size: 11px; opacity: 0.9;">Isolated Object Stores</div>
      </div>

      <div class="view-header">
        <div class="header-left">
          <div class="view-title">Backtest Books</div>
        </div>
        <div class="header-right">
          <button class="btn btn-primary" id="btn-create-book">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Create Backtest Book
          </button>
        </div>
      </div>

      <div class="view-content" id="bt-books-content">
        <div id="bt-books-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;"></div>
      </div>
    `;

    this.container.querySelector('#btn-create-book').addEventListener('click', () => {
      this.openCreateBookModal();
    });

    await this.loadBooks();
  }

  async loadBooks() {
    this.books = await BacktestRepo.getAllBooks();


    const grid = this.container.querySelector('#bt-books-grid');
    grid.innerHTML = '';

    if (this.books.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div style="font-size: 28px; opacity: 0.6;">📚</div>
          <div class="empty-state-title">No backtests yet</div>
          <div class="empty-state-desc">Create your first Backtest Book (e.g. ICT 2026, XAUUSD FVG, London Breakout) to record model validations.</div>
          <button class="btn btn-primary" id="empty-create-book-btn">+ Create Backtest</button>
        </div>
      `;
      grid.querySelector('#empty-create-book-btn').addEventListener('click', () => this.openCreateBookModal());
      return;
    }

    // 遍历每个 Book，查询并计算各自专属的统计数据
    for (const book of this.books) {
      const trades = await BacktestRepo.getTradesByBookId(book.id);
      const metrics = aggregateMetrics(trades, book.initial_balance || 10000);

      const card = document.createElement('div');
      card.className = 'kpi-card';
      card.style.cursor = 'pointer';
      card.style.transition = 'border-color 0.1s ease, box-shadow 0.1s ease';

      const pnlClass = getMetricColorClass(metrics.netPnl);

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div>
            <div style="font-size: 14px; font-weight: 700; color: var(--text-main);">${book.name}</div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
              ${book.symbol || 'All Symbols'} • ${book.timeframe || 'Any TF'} • ${trades.length} trades
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0; padding: 8px 0; border-top: 1px solid var(--border-subtle); border-bottom: 1px solid var(--border-subtle);">
          <div>
            <div style="font-size: 10px; color: var(--text-tertiary); text-transform: uppercase;">Net P&L</div>
            <div style="font-size: 14px; font-weight: 700;" class="font-mono ${pnlClass}">${formatCurrency(metrics.netPnl)}</div>
          </div>
          <div>
            <div style="font-size: 10px; color: var(--text-tertiary); text-transform: uppercase;">Total R</div>
            <div style="font-size: 14px; font-weight: 700;" class="font-mono ${getMetricColorClass(metrics.totalR)}">${formatR(metrics.totalR)}</div>
          </div>
          <div>
            <div style="font-size: 10px; color: var(--text-tertiary); text-transform: uppercase;">Win Rate</div>
            <div style="font-size: 13px; font-weight: 600;" class="font-mono">${metrics.winRate.toFixed(1)}%</div>
          </div>
          <div>
            <div style="font-size: 10px; color: var(--text-tertiary); text-transform: uppercase;">Profit Factor</div>
            <div style="font-size: 13px; font-weight: 600;" class="font-mono">${metrics.profitFactor !== null ? metrics.profitFactor.toFixed(2) : 'N/A'}</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-tertiary); margin-top: 4px;">
          <span>Init: $${(book.initial_balance || 10000).toLocaleString()}</span>
          <span>Open Book →</span>
        </div>
      `;

      card.addEventListener('mouseenter', () => {
        card.style.borderColor = 'var(--accent)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.borderColor = 'var(--border-subtle)';
      });

      card.addEventListener('click', () => {
        this.onSelectBook(book.id);
      });

      grid.appendChild(card);
    }
  }

  openCreateBookModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal-content" style="width: 520px;">
        <div class="modal-header">
          <div class="modal-title">Create Backtest Book</div>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Book Name *</label>
            <input type="text" class="form-input" id="book-name" placeholder="e.g. ICT 2026, XAUUSD FVG Model">
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Strategy / Model</label>
              <input type="text" class="form-input" id="book-strategy" placeholder="e.g. Liquidity Sweep, SMC">
            </div>
            <div class="form-group">
              <label class="form-label">Primary Symbol</label>
              <input type="text" class="form-input" id="book-symbol" placeholder="e.g. EURUSD, XAUUSD, BTC">
            </div>
          </div>
          <div class="form-grid-3">
            <div class="form-group">
              <label class="form-label">Timeframe</label>
              <input type="text" class="form-input" id="book-timeframe" placeholder="1m, 5m, 15m, 1H, 4H, Daily">
            </div>
            <div class="form-group">
              <label class="form-label">Market</label>
              <input type="text" class="form-input" id="book-market" placeholder="Forex, Futures, etc.">
            </div>
            <div class="form-group">
              <label class="form-label">Initial Balance ($)</label>
              <input type="number" class="form-input" id="book-balance" value="10000">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Risk Model</label>
            <input type="text" class="form-input" id="book-risk-model" placeholder="e.g. Fixed 1%, Fixed $200 per trade">
          </div>
          <div class="form-group">
            <label class="form-label">Description / Objective</label>
            <textarea class="form-textarea" id="book-description" placeholder="Objective, backtest hypothesis, data rules..."></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" id="book-cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="book-save-btn">Create Book</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => document.body.removeChild(overlay);
    overlay.querySelector('.modal-close-btn').addEventListener('click', close);
    overlay.querySelector('#book-cancel-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    overlay.querySelector('#book-save-btn').addEventListener('click', async () => {
      const name = overlay.querySelector('#book-name').value.trim();
      if (!name) {
        alert('Book Name is required.');
        return;
      }

      await BacktestRepo.saveBook({
        name,
        strategy: overlay.querySelector('#book-strategy').value.trim(),
        symbol: overlay.querySelector('#book-symbol').value.trim().toUpperCase(),
        timeframe: overlay.querySelector('#book-timeframe').value.trim(),
        market: overlay.querySelector('#book-market').value.trim(),
        initial_balance: Number(overlay.querySelector('#book-balance').value) || 10000,
        risk_model: overlay.querySelector('#book-risk-model').value.trim(),
        description: overlay.querySelector('#book-description').value.trim()
      });

      close();
      await this.loadBooks();
    });
  }
}
