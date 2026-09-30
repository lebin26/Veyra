/**
 * dailyJournalView.js
 * 1 分钟每日极速复盘视图（1-Minute End of Day Journal）：
 * 不写冗长作文，每天只回答 3 个关键问题：
 * 1. 今天做得最好的一件事？
 * 2. 今天最大的问题？
 * 3. 明天要改什么？
 * 上方自动汇总当天的净盈亏、R、胜率及所有交易明细。
 */

import { LiveRepo } from '../db/liveRepo.js';
import { DailyJournalRepo } from '../db/dailyJournalRepo.js';
import { aggregateMetrics } from '../core/calculations.js';
import { formatCurrency, formatR, getMetricColorClass } from '../core/formatters.js';
import { TradeTable } from '../components/tradeTable.js';
import { TradeDrawer } from '../components/tradeDrawer.js';

export class DailyJournalView {
  constructor(options = {}) {
    this.container = options.container;
    this.selectedDate = options.initialDate || new Date().toISOString().split('T')[0];
    this.allTrades = [];
    this.dayTrades = [];
    this.journalEntry = null;
    this.account = null;
  }

  async render() {
    this.account = await LiveRepo.getAccount();
    this.allTrades = await LiveRepo.getAllTrades();

    this.container.innerHTML = `
      <div class="view-header">
        <div class="header-left">
          <div class="view-title">Daily Review (1-Minute Journal)</div>
          <div style="display: flex; align-items: center; gap: 6px; margin-left: 14px;">
            <input type="date" class="form-input" id="dj-date-picker" value="${this.selectedDate}" style="font-weight: 700;">
            <button class="btn btn-sm" id="dj-btn-prev">← Prev</button>
            <button class="btn btn-sm" id="dj-btn-today">Today</button>
            <button class="btn btn-sm" id="dj-btn-next">Next →</button>
          </div>
        </div>
        <div class="header-right">
          <button class="btn btn-primary" id="btn-save-daily-journal" style="font-weight: 700;">
            ✓ Save Day Journal
          </button>
        </div>
      </div>

      <div class="view-content" id="daily-journal-content" style="max-width: 900px;">
        <!-- 1. Day Performance Auto Summary -->
        <div id="dj-kpi-bar" style="margin-bottom: 14px;"></div>

        <!-- 2. The 3-Question Daily Reflection (VEYRA 1-Min Journal) -->
        <div class="chart-card" style="padding: 16px 20px; border-color: var(--border-strong);">
          <div class="chart-card-header" style="margin-bottom: 6px;">
            <div class="chart-card-title" style="color: var(--text-main); font-size: 13px;">
              ⚡ 1-Minute Daily Reflection
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px; color: var(--text-secondary);">Day Discipline:</span>
              <select class="form-select" id="dj-execution-rating" style="font-weight: 700; padding: 3px 8px;">
                <option value="5">★★★★★ (5/5 Clean & Disciplined)</option>
                <option value="4">★★★★☆ (4/5 Solid Execution)</option>
                <option value="3">★★★☆☆ (3/5 Average Execution)</option>
                <option value="2">★★☆☆☆ (2/5 Rule Slip)</option>
                <option value="1">★☆☆☆☆ (1/5 Emotionally Hijacked)</option>
              </select>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: var(--profit-color);">
                1. 今天做得最好的一件事？ (What went well today?)
              </label>
              <input type="text" class="form-input" id="dj-q1-best" placeholder="e.g. 严格在 2R 止盈，没有追高，耐心等待入场确认..." style="padding: 8px 10px; font-size: 13px;">
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: var(--loss-color);">
                2. 今天最大的问题？ (What was the biggest mistake or friction?)
              </label>
              <input type="text" class="form-input" id="dj-q2-worst" placeholder="e.g. 第二单稍微有点 FOMO，开盘前没看关键新闻..." style="padding: 8px 10px; font-size: 13px;">
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 12px; font-weight: 700; color: var(--text-main);">
                3. 明天要改什么？ (What to adjust tomorrow?)
              </label>
              <input type="text" class="form-input" id="dj-q3-improve" placeholder="e.g. 每天只做前两笔 A+ 机会，做完立即关闭行情软件..." style="padding: 8px 10px; font-size: 13px;">
            </div>
          </div>
        </div>

        <!-- 3. Day's Executed Trades Table -->
        <div class="chart-card" style="margin-top: 14px;">
          <div class="chart-card-header">
            <div class="chart-card-title">Trades Executed on This Day</div>
          </div>
          <div id="dj-table-host" style="margin-top: 8px;"></div>
        </div>
      </div>
    `;

    this.bindEvents();
    await this.loadDayData();
  }

  bindEvents() {
    const picker = this.container.querySelector('#dj-date-picker');
    picker.addEventListener('change', async (e) => {
      this.selectedDate = e.target.value;
      await this.loadDayData();
    });

    this.container.querySelector('#dj-btn-prev').addEventListener('click', async () => {
      const d = new Date(this.selectedDate);
      d.setDate(d.getDate() - 1);
      this.selectedDate = d.toISOString().split('T')[0];
      picker.value = this.selectedDate;
      await this.loadDayData();
    });

    this.container.querySelector('#dj-btn-next').addEventListener('click', async () => {
      const d = new Date(this.selectedDate);
      d.setDate(d.getDate() + 1);
      this.selectedDate = d.toISOString().split('T')[0];
      picker.value = this.selectedDate;
      await this.loadDayData();
    });

    this.container.querySelector('#dj-btn-today').addEventListener('click', async () => {
      this.selectedDate = new Date().toISOString().split('T')[0];
      picker.value = this.selectedDate;
      await this.loadDayData();
    });

    this.container.querySelector('#btn-save-daily-journal').addEventListener('click', async () => {
      await this.saveCurrentJournal();
    });
  }

  async loadDayData() {
    this.dayTrades = this.allTrades.filter(t => t.date === this.selectedDate);
    this.journalEntry = await DailyJournalRepo.getJournalByDate(this.selectedDate);

    const je = this.journalEntry || {};
    this.container.querySelector('#dj-q1-best').value = je.what_went_well || '';
    this.container.querySelector('#dj-q2-worst').value = je.mistakes || '';
    this.container.querySelector('#dj-q3-improve').value = je.plan || '';
    this.container.querySelector('#dj-execution-rating').value = String(je.execution_rating || 5);

    this.renderDayKPI();
    this.renderDayTradesTable();
  }

  renderDayKPI() {
    const kpiHost = this.container.querySelector('#dj-kpi-bar');
    const m = aggregateMetrics(this.dayTrades, this.account ? this.account.starting_balance : 10000);

    kpiHost.innerHTML = `
      <div style="background: var(--surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px;">
        <div>
          <div class="kpi-label">Day Net P&L</div>
          <div class="kpi-value font-mono ${getMetricColorClass(m.netPnl)}">${formatCurrency(m.netPnl)}</div>
          <div class="kpi-subtext">Total cash outcome</div>
        </div>
        <div>
          <div class="kpi-label">Day Total R</div>
          <div class="kpi-value font-mono ${getMetricColorClass(m.totalR)}">${formatR(m.totalR)}</div>
          <div class="kpi-subtext">${m.rCount} risk-defined</div>
        </div>
        <div>
          <div class="kpi-label">Day Win Rate</div>
          <div class="kpi-value font-mono">${m.winRate.toFixed(1)}%</div>
          <div class="kpi-subtext">${m.winningTrades}W - ${m.losingTrades}L - ${m.beTrades}BE</div>
        </div>
        <div>
          <div class="kpi-label">Profit Factor</div>
          <div class="kpi-value font-mono">${m.profitFactor !== null ? m.profitFactor.toFixed(2) : 'N/A'}</div>
          <div class="kpi-subtext">Gross W / Gross L</div>
        </div>
        <div>
          <div class="kpi-label">Best Trade</div>
          <div class="kpi-value font-mono text-profit">${formatCurrency(m.largestWin, false)}</div>
          <div class="kpi-subtext">Peak winner</div>
        </div>
        <div>
          <div class="kpi-label">Worst Trade</div>
          <div class="kpi-value font-mono text-loss">${formatCurrency(m.largestLoss, false)}</div>
          <div class="kpi-subtext">Max loss</div>
        </div>
      </div>
    `;
  }

  renderDayTradesTable() {
    const tableHost = this.container.querySelector('#dj-table-host');
    if (!tableHost) return;

    if (this.dayTrades.length === 0) {
      tableHost.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-tertiary); font-size: 12px;">
          No trades executed on ${this.selectedDate}.
        </div>
      `;
      return;
    }

    new TradeTable({
      container: tableHost,
      trades: this.dayTrades,
      accountBalance: this.account ? this.account.starting_balance : 10000,
      onRowClick: async (trade) => {
        const screens = await LiveRepo.getScreenshotsByTradeId(trade.id);
        new TradeDrawer({
          trade,
          screenshots: screens,
          accountBalance: this.account.starting_balance,
          onUpdated: async () => {
            this.allTrades = await LiveRepo.getAllTrades();
            await this.loadDayData();
          },
          onDelete: async (tradeId) => {
            await LiveRepo.deleteTrade(tradeId);
            this.allTrades = await LiveRepo.getAllTrades();
            await this.loadDayData();
          }
        });
      }
    });
  }

  async saveCurrentJournal() {
    const payload = {
      date: this.selectedDate,
      what_went_well: this.container.querySelector('#dj-q1-best').value.trim(),
      mistakes: this.container.querySelector('#dj-q2-worst').value.trim(),
      plan: this.container.querySelector('#dj-q3-improve').value.trim(),
      execution_rating: Number(this.container.querySelector('#dj-execution-rating').value) || 5
    };

    await DailyJournalRepo.saveJournal(payload);
    alert(`1-Minute Journal for ${this.selectedDate} saved successfully.`);
  }
}
