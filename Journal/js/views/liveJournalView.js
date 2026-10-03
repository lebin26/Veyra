import { LiveRepo } from '../db/liveRepo.js';
import { aggregateMetrics } from '../core/calculations.js';
import { TradeTable } from '../components/tradeTable.js';
import { TradeModal } from '../components/tradeModal.js';
import { TradeDrawer } from '../components/tradeDrawer.js';
import { renderCircularGauge, renderWinLossBar } from '../components/charts.js';
import { formatCurrency, formatPercent, getMetricColorClass } from '../core/formatters.js';

export class LiveJournalView {
  constructor(options = {}) {
    this.container = options.container;
    this.account = null;
    this.trades = [];
    this.screenshotsMap = {};
    this.tradeTable = null;
  }

  async render() {
    this.container.innerHTML = `
      <div class="view-header" style="padding: 16px 24px; border-bottom: 1px solid var(--border-default); background: var(--bg-panel); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div class="header-left" style="display: flex; align-items: center; gap: 12px;">
          <h1 class="view-title" style="font-size: 20px; font-weight: 700; margin: 0; color: var(--text-primary); letter-spacing: -0.02em;">Trade Log</h1>
          <span style="font-size: 11.5px; color: var(--text-secondary); background: var(--fill-subtle); padding: 3px 8px; border-radius: var(--radius-chip);" id="trades-total-badge">
            0 Trades
          </span>
        </div>
        <div class="header-right" style="display: flex; align-items: center; gap: 8px;">
          <!-- Bulk Actions Button -->
          <div style="position: relative;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-trades-bulk" style="padding: 5px 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
              <span>Bulk Actions</span>
              <span style="font-size: 9px;">▼</span>
            </button>
            <div id="bulk-actions-menu" style="display: none; position: absolute; right: 0; top: 100%; margin-top: 4px; background: var(--bg-panel); border: 1px solid var(--border-default); border-radius: var(--radius-control); box-shadow: 0 4px 14px rgba(0,0,0,0.1); width: 160px; z-index: 100; overflow: hidden;">
              <button type="button" class="bulk-item" id="bulk-export-csv" style="width: 100%; text-align: left; padding: 8px 12px; font-size: 11.5px; background: none; border: none; color: var(--text-primary); cursor: pointer;">Export CSV</button>
              <button type="button" class="bulk-item" id="bulk-assign-playbook" style="width: 100%; text-align: left; padding: 8px 12px; font-size: 11.5px; background: none; border: none; color: var(--text-primary); cursor: pointer;">Assign Playbook</button>
              <button type="button" class="bulk-item" id="bulk-delete-all" style="width: 100%; text-align: left; padding: 8px 12px; font-size: 11.5px; background: none; border: none; color: var(--color-loss); cursor: pointer; border-top: 1px solid var(--border-default);">Clear All Trades</button>
            </div>
          </div>

          <button class="btn btn-primary" id="btn-add-live-trade" style="font-weight: 700; padding: 6px 14px; font-size: 12px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            + Quick Trade
          </button>
        </div>
      </div>

      <div class="view-content" id="live-journal-content" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; max-width: 1400px; margin: 0 auto; width: 100%;">
        <!-- Top 4 KPI Cards (Matching PDF Page 5) -->
        <div id="trades-kpi-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;"></div>

        <!-- Main Trades Table -->
        <div id="live-table-container"></div>
      </div>
    `;

    // Dropdown toggle
    const bulkBtn = this.container.querySelector('#btn-trades-bulk');
    const bulkMenu = this.container.querySelector('#bulk-actions-menu');
    if (bulkBtn && bulkMenu) {
      bulkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        bulkMenu.style.display = bulkMenu.style.display === 'none' ? 'block' : 'none';
      });
      document.addEventListener('click', () => {
        if (bulkMenu) bulkMenu.style.display = 'none';
      });
      this.container.querySelector('#bulk-export-csv').addEventListener('click', () => this.exportCsv());
      this.container.querySelector('#bulk-delete-all').addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete all trades? This cannot be undone.')) {
          for (const t of this.trades) {
            await LiveRepo.deleteTrade(t.id);
          }
          await this.loadData();
        }
      });
    }

    this.container.querySelector('#btn-add-live-trade').addEventListener('click', () => {
      this.openAddModal();
    });

    await this.loadData();
  }

  exportCsv() {
    if (!this.trades.length) return alert('No trades to export');
    const headers = ['Date', 'Symbol', 'Side', 'Entry', 'Exit', 'Size', 'P&L', 'R', 'Setup', 'Notes'];
    const rows = this.trades.map(t => [
      t.date || '',
      t.symbol || '',
      t.direction || t.side || '',
      t.entry_price || '',
      t.exit_price || '',
      t.position_size || '',
      t.pnl || '',
      t.r || '',
      t.setup || '',
      (t.notes || '').replace(/,/g, ' ')
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `trades_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  renderKpiCards(metrics) {
    const host = this.container.querySelector('#trades-kpi-container');
    if (!host) return;

    const netVal = metrics.netPnl || 0;
    const netClass = getMetricColorClass(netVal);
    const winRate = metrics.winRate || 0;
    const pf = metrics.profitFactor !== null && metrics.profitFactor !== undefined ? Number(metrics.profitFactor) : 0;
    const avgWin = metrics.averageWin || 0;
    const avgLoss = Math.abs(metrics.averageLoss || 0);
    const ratio = avgLoss > 0 ? (avgWin / avgLoss) : 0;

    host.innerHTML = `
      <!-- Card 1: Net Cumulative P&L -->
      <div class="kpi-card" style="padding: 12px 16px; display: flex; flex-direction: column; justify-content: space-between; min-height: 90px;">
        <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Net Cumulative P&L</div>
        <div style="font-size: 20px; font-weight: 700; font-family: var(--font-mono);" class="${netClass}">${formatCurrency(netVal)}</div>
        <div style="font-size: 10.5px; color: var(--text-tertiary);">${metrics.totalTrades || 0} trades recorded</div>
      </div>

      <!-- Card 2: Profit Factor -->
      <div class="kpi-card" style="padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; min-height: 90px;">
        <div>
          <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Profit Factor</div>
          <div style="font-size: 20px; font-weight: 700; font-family: var(--font-mono); color: var(--text-primary); margin-top: 3px;">${pf > 0 ? pf.toFixed(2) : '0.00'}</div>
          <div style="font-size: 10px; color: var(--text-tertiary);">Gross edge</div>
        </div>
        <div>
          ${renderCircularGauge(Math.min(100, (pf / 3.0) * 100), '#4FC3A1', 48)}
        </div>
      </div>

      <!-- Card 3: Trade Win % -->
      <div class="kpi-card" style="padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; min-height: 90px;">
        <div>
          <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Trade Win %</div>
          <div style="font-size: 20px; font-weight: 700; font-family: var(--font-mono); color: var(--text-primary); margin-top: 3px;">${winRate.toFixed(2)}%</div>
          <div style="font-size: 10px; color: var(--text-tertiary);">${metrics.winningTrades || 0}W / ${metrics.losingTrades || 0}L</div>
        </div>
        <div>
          ${renderCircularGauge(winRate, '#5B55D9', 48)}
        </div>
      </div>

      <!-- Card 4: Avg win/loss trade -->
      <div class="kpi-card" style="padding: 12px 16px; display: flex; flex-direction: column; justify-content: space-between; min-height: 90px;">
        <div>
          <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Avg win/loss trade</div>
          <div style="font-size: 20px; font-weight: 700; font-family: var(--font-mono); color: var(--text-primary); margin: 2px 0;">${ratio > 0 ? ratio.toFixed(2) : '0.00'}</div>
        </div>
        ${renderWinLossBar(avgWin, avgLoss, ratio)}
      </div>
    `;
  }


  async loadData() {
    this.account = await LiveRepo.getAccount();
    this.trades = await LiveRepo.getAllTrades();

    this.screenshotsMap = {};
    for (const trade of this.trades) {
      const screens = await LiveRepo.getScreenshotsByTradeId(trade.id);
      this.screenshotsMap[trade.id] = screens.length;
    }

    const badge = this.container.querySelector('#trades-total-badge');
    if (badge) badge.textContent = `${this.trades.length} Trades`;

    const metrics = aggregateMetrics(this.trades);
    this.renderKpiCards(metrics);

    const tableHost = this.container.querySelector('#live-table-container');
    if (this.trades.length === 0) {
      tableHost.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 28px; opacity: 0.6;">📝</div>
          <div class="empty-state-title">No live trades yet</div>
          <div class="empty-state-desc">Record your first execution in 10 seconds. Enter entry, exit, size, stop loss, and let the system calculate the rest.</div>
          <button class="btn btn-primary" id="empty-add-btn" style="margin-top: 6px;">+ Quick Trade (10s)</button>
        </div>
      `;
      tableHost.querySelector('#empty-add-btn').addEventListener('click', () => this.openAddModal());
      return;
    }

    this.tradeTable = new TradeTable({
      container: tableHost,
      trades: this.trades,
      screenshotsMap: this.screenshotsMap,
      onRowClick: (trade, opts) => this.openDetailDrawer(trade, opts)
    });
  }

  openAddModal(existingTrade = null, existingScreenshots = []) {
    new TradeModal({
      mode: 'LIVE',
      trade: existingTrade,
      screenshots: existingScreenshots,
      onSave: async (tradeData, pendingScreenshots) => {
        const saved = await LiveRepo.saveTrade(tradeData);

        for (let i = 0; i < pendingScreenshots.length; i++) {
          const item = pendingScreenshots[i];
          if (!item.trade_id) {
            await LiveRepo.saveScreenshot({
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
    const screens = await LiveRepo.getScreenshotsByTradeId(trade.id);
    new TradeDrawer({
      trade,
      screenshots: screens,
      mode: 'LIVE',
      focusClose: options.focusClose || false,
      onUpdated: async () => {
        await this.loadData();
      },
      onDelete: async (tradeId) => {
        await LiveRepo.deleteTrade(tradeId);
        await this.loadData();
      }
    });
  }
}
