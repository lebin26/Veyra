/**
 * analyticsView.js
 * LIVE TRADING 多维度切片深度分析中心（配 Time Interval Filter）：
 * 彻底不依赖 account balance，纯粹分析各维度的 Net P&L 与 R！
 * 支持在指定时间区间内，深度切片分析：
 * By Symbol, Setup, Mistake, Emotion, Discipline, Direction, Session, Day.
 */

import { LiveRepo } from '../db/liveRepo.js';
import { aggregateMetrics } from '../core/calculations.js';
import { formatCurrency, formatR, getMetricColorClass } from '../core/formatters.js';

export class AnalyticsView {
  constructor(options = {}) {
    this.container = options.container;
    this.trades = [];
    this.startDate = '';
    this.endDate = '';
    this.activeTab = 'symbol';
  }

  async render() {
    this.trades = await LiveRepo.getAllTrades();

    this.container.innerHTML = `
      <div class="view-header">
        <div class="header-left">
          <div class="view-title">Live Analytics & Performance Reports</div>
        </div>
      </div>

      <div class="view-content" id="analytics-content">
        <!-- Interval & Tabs Filter Toolbar -->
        <div class="table-toolbar" style="background: var(--surface); padding: 10px 14px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Interval:</span>
            <input type="date" class="table-select" id="analytics-start-date" value="${this.startDate}">
            <span style="color: var(--text-tertiary); font-size: 11px;">to</span>
            <input type="date" class="table-select" id="analytics-end-date" value="${this.endDate}">
          </div>

          <div style="font-size: 11.5px; color: var(--text-tertiary);" id="analytics-filtered-summary">
            Filtered Trades: ${this.trades.length}
          </div>
        </div>

        <!-- Reports Sub-navigation Tabs -->
        <div style="display: flex; gap: 6px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px; flex-wrap: wrap;">
          <button class="btn btn-sm analytics-tab-btn ${this.activeTab === 'symbol' ? 'btn-primary' : ''}" data-tab="symbol">By Symbol</button>
          <button class="btn btn-sm analytics-tab-btn ${this.activeTab === 'setup' ? 'btn-primary' : ''}" data-tab="setup">By Setup</button>
          <button class="btn btn-sm analytics-tab-btn ${this.activeTab === 'mistake' ? 'btn-primary' : ''}" data-tab="mistake">By Mistake</button>
          <button class="btn btn-sm analytics-tab-btn ${this.activeTab === 'emotion' ? 'btn-primary' : ''}" data-tab="emotion">By Emotion</button>
          <button class="btn btn-sm analytics-tab-btn ${this.activeTab === 'discipline' ? 'btn-primary' : ''}" data-tab="discipline">By Discipline</button>
          <button class="btn btn-sm analytics-tab-btn ${this.activeTab === 'direction' ? 'btn-primary' : ''}" data-tab="direction">By Direction</button>
          <button class="btn btn-sm analytics-tab-btn ${this.activeTab === 'session' ? 'btn-primary' : ''}" data-tab="session">By Session</button>
          <button class="btn btn-sm analytics-tab-btn ${this.activeTab === 'day' ? 'btn-primary' : ''}" data-tab="day">By Day of Week</button>
        </div>

        <div id="analytics-table-host" style="margin-top: 10px;"></div>
      </div>
    `;

    this.container.querySelectorAll('.analytics-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.analytics-tab-btn').forEach(b => b.classList.remove('btn-primary'));
        btn.classList.add('btn-primary');
        this.activeTab = btn.dataset.tab;
        this.renderTabContent();
      });
    });

    this.container.querySelector('#analytics-start-date').addEventListener('change', (e) => {
      this.startDate = e.target.value;
      this.renderTabContent();
    });

    this.container.querySelector('#analytics-end-date').addEventListener('change', (e) => {
      this.endDate = e.target.value;
      this.renderTabContent();
    });

    this.renderTabContent();
  }

  getFilteredTrades() {
    return this.trades.filter(t => {
      if (this.startDate && t.date < this.startDate) return false;
      if (this.endDate && t.date > this.endDate) return false;
      return true;
    });
  }

  renderTabContent() {
    const host = this.container.querySelector('#analytics-table-host');
    if (!host) return;

    const filtered = this.getFilteredTrades();
    const summaryEl = this.container.querySelector('#analytics-filtered-summary');
    if (summaryEl) summaryEl.textContent = `Filtered Trades: ${filtered.length}`;

    if (filtered.length === 0) {
      host.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">No trades in selected interval</div>
          <div class="empty-state-desc">Adjust the date interval or record trades in the Live Journal.</div>
        </div>
      `;
      return;
    }

    let groups = {};

    if (this.activeTab === 'symbol') {
      filtered.forEach(t => {
        const key = t.symbol || 'Unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });
    } else if (this.activeTab === 'setup') {
      filtered.forEach(t => {
        const key = t.setup || 'No Setup';
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });
    } else if (this.activeTab === 'mistake') {
      filtered.forEach(t => {
        const key = t.mistake && String(t.mistake).trim() !== '' ? t.mistake : 'No Mistake (Clean)';
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });
    } else if (this.activeTab === 'emotion') {
      filtered.forEach(t => {
        const key = t.emotion && String(t.emotion).trim() !== '' ? t.emotion : 'Neutral / Unrecorded';
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });
    } else if (this.activeTab === 'discipline') {
      filtered.forEach(t => {
        const key = t.followed_plan === false ? '✗ Rule Broken (Undisciplined)' : '✓ Followed Plan (Disciplined)';
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });
    } else if (this.activeTab === 'direction') {
      filtered.forEach(t => {
        const key = t.direction || 'Unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });
    } else if (this.activeTab === 'session') {
      filtered.forEach(t => {
        if (!t.session) return;
        const key = t.session;
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });
    } else if (this.activeTab === 'day') {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      filtered.forEach(t => {
        if (!t.date) return;
        const d = new Date(t.date);
        const dayName = dayNames[d.getDay()];
        if (!groups[dayName]) groups[dayName] = [];
        groups[dayName].push(t);
      });
    }

    const rows = Object.keys(groups).map(key => {
      const list = groups[key];
      const m = aggregateMetrics(list);
      return {
        dimension: key,
        trades: m.totalTrades,
        winRate: m.winRate,
        netPnl: m.netPnl,
        totalR: m.totalR,
        averageR: m.averageR,
        payoffRatio: m.payoffRatio,
        profitFactor: m.profitFactor,
        expectancyAmount: m.expectancyAmount
      };
    });

    rows.sort((a, b) => b.netPnl - a.netPnl);

    const tableHtml = `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Dimension</th>
              <th class="text-right">Trades</th>
              <th class="text-right">Win Rate</th>
              <th class="text-right">Net P&L</th>
              <th class="text-right">Total R</th>
              <th class="text-right">Avg R</th>
              <th class="text-right">Payoff Ratio</th>
              <th class="text-right">Expectancy $</th>
              <th class="text-right">Profit Factor</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td style="font-weight: 700;">${r.dimension}</td>
                <td class="text-right font-mono">${r.trades}</td>
                <td class="text-right font-mono">${r.winRate.toFixed(1)}%</td>
                <td class="text-right font-mono ${getMetricColorClass(r.netPnl)}">${formatCurrency(r.netPnl)}</td>
                <td class="text-right font-mono ${getMetricColorClass(r.totalR)}">${formatR(r.totalR)}</td>
                <td class="text-right font-mono ${getMetricColorClass(r.averageR)}">${r.averageR !== null ? formatR(r.averageR) : 'N/A'}</td>
                <td class="text-right font-mono">${r.payoffRatio !== null ? r.payoffRatio.toFixed(2) : 'N/A'}</td>
                <td class="text-right font-mono ${getMetricColorClass(r.expectancyAmount)}">${formatCurrency(r.expectancyAmount)}</td>
                <td class="text-right font-mono">${r.profitFactor !== null ? r.profitFactor.toFixed(2) : 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    host.innerHTML = tableHtml;
  }
}
