/**
 * liveJournalView.js
 * LIVE TRADING 核心日志视图（极速减负版）：
 * - 顶部 + Add Trade (10 秒 Quick Add)
 * - 高密度数据表
 * - 点击任何一行即刻唤出 30 秒快捷补充 Review Drawer
 */

import { LiveRepo } from '../db/liveRepo.js';
import { TradeTable } from '../components/tradeTable.js';
import { TradeModal } from '../components/tradeModal.js';
import { TradeDrawer } from '../components/tradeDrawer.js';

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
      <div class="view-header">
        <div class="header-left">
          <div class="view-title">Trades</div>
        </div>
        <div class="header-right">
          <button class="btn btn-primary" id="btn-add-live-trade" style="font-weight: 700; padding: 6px 14px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            + Quick Trade (10s)
          </button>
        </div>
      </div>

      <div class="view-content" id="live-journal-content">
        <div id="live-table-container"></div>
      </div>
    `;

    this.container.querySelector('#btn-add-live-trade').addEventListener('click', () => {
      this.openAddModal();
    });

    await this.loadData();
  }

  async loadData() {
    this.account = await LiveRepo.getAccount();
    this.trades = await LiveRepo.getAllTrades();

    this.screenshotsMap = {};
    for (const trade of this.trades) {
      const screens = await LiveRepo.getScreenshotsByTradeId(trade.id);
      this.screenshotsMap[trade.id] = screens.length;
    }



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
