/**
 * liveDashboardView.js
 * LIVE TRADING 主仪表盘（纯净 P&L & R 计算，完整 Time Interval Filter）：
 * 彻底不依赖 account balance，移除任何 balance 概念。
 * 顶部配备强大完整的时间区间过滤器 (Today, Yesterday, This Week, Last Week, This Month, Custom Interval)
 */

import { LiveRepo } from '../db/liveRepo.js';
import { aggregateMetrics } from '../core/calculations.js';
import { MetricCards } from '../components/metricCards.js';
import { EquityCurveChart, DailyPnlChart, RDistributionChart } from '../components/charts.js';
import { TradingCalendar } from '../components/calendar.js';
import { formatCurrency, getMetricColorClass } from '../core/formatters.js';

export class LiveDashboardView {
  constructor(options = {}) {
    this.container = options.container;
    this.trades = [];
    this.unit = '$'; // '$' | 'R'
    this.timePreset = 'ALL'; // 'ALL', 'TODAY', 'YESTERDAY', 'THIS_WEEK', 'LAST_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'THIS_YEAR', 'CUSTOM'
    this.startDate = '';
    this.endDate = '';
    this.symbolFilter = 'ALL';
    this.setupFilter = 'ALL';
  }

  async render() {
    this.trades = await LiveRepo.getAllTrades();

    this.container.innerHTML = `
      <div class="view-header">
        <div class="header-left">
          <div class="view-title">Dashboard</div>
        </div>
        <div class="header-right">
          <!-- Metric Unit Toggle: Pure $ and R -->
          <div class="unit-toggle-group">
            <button class="unit-btn ${this.unit === '$' ? 'active' : ''}" data-unit="$">$ (Cash)</button>
            <button class="unit-btn ${this.unit === 'R' ? 'active' : ''}" data-unit="R">R (Risk Multiple)</button>
          </div>
        </div>
      </div>

      <div class="view-content" id="dashboard-content">
        <!-- Time Interval & Dimensional Filters Toolbar -->
        <div class="table-toolbar" style="background: var(--surface); padding: 10px 14px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); gap: 10px;">
          <!-- Time Interval Section -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Interval:</span>
            <select class="table-select" id="dash-time-preset" style="font-weight: 600;">
              <option value="ALL" ${this.timePreset === 'ALL' ? 'selected' : ''}>All Time</option>
              <option value="TODAY" ${this.timePreset === 'TODAY' ? 'selected' : ''}>Today</option>
              <option value="YESTERDAY" ${this.timePreset === 'YESTERDAY' ? 'selected' : ''}>Yesterday</option>
              <option value="THIS_WEEK" ${this.timePreset === 'THIS_WEEK' ? 'selected' : ''}>This Week</option>
              <option value="LAST_WEEK" ${this.timePreset === 'LAST_WEEK' ? 'selected' : ''}>Last Week</option>
              <option value="THIS_MONTH" ${this.timePreset === 'THIS_MONTH' ? 'selected' : ''}>This Month</option>
              <option value="LAST_MONTH" ${this.timePreset === 'LAST_MONTH' ? 'selected' : ''}>Last Month</option>
              <option value="THIS_YEAR" ${this.timePreset === 'THIS_YEAR' ? 'selected' : ''}>This Year</option>
              <option value="CUSTOM" ${this.timePreset === 'CUSTOM' ? 'selected' : ''}>Custom Range →</option>
            </select>

            <!-- Custom Date Inputs -->
            <div style="display: flex; align-items: center; gap: 4px;">
              <input type="date" class="table-select" id="dash-start-date" value="${this.startDate}" title="Start Date">
              <span style="color: var(--text-tertiary); font-size: 11px;">to</span>
              <input type="date" class="table-select" id="dash-end-date" value="${this.endDate}" title="End Date">
            </div>

            <div style="width: 1px; height: 18px; background: var(--border-subtle); margin: 0 4px;"></div>

            <!-- Dimensions -->
            <select class="table-select" id="dash-symbol-filter">
              <option value="ALL">All Symbols</option>
            </select>

            <select class="table-select" id="dash-setup-filter">
              <option value="ALL">All Strategies</option>
            </select>
          </div>

          <div style="font-size: 11.5px; color: var(--text-tertiary);" id="dash-filtered-count">
            Filtered Trades: 0
          </div>
        </div>

        <!-- Dashboard Body -->
        <div id="dash-body"></div>
      </div>
    `;

    this.bindEvents();
    this.populateFilterOptions();
    this.updateDashboard();
  }

  bindEvents() {
    this.container.querySelectorAll('.unit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.unit = btn.dataset.unit;
        this.updateDashboard();
      });
    });

    const presetSelect = this.container.querySelector('#dash-time-preset');
    const startInput = this.container.querySelector('#dash-start-date');
    const endInput = this.container.querySelector('#dash-end-date');

    presetSelect.addEventListener('change', (e) => {
      this.timePreset = e.target.value;
      this.applyPresetToInputs();
      this.updateDashboard();
    });

    startInput.addEventListener('change', (e) => {
      this.startDate = e.target.value;
      this.timePreset = 'CUSTOM';
      presetSelect.value = 'CUSTOM';
      this.updateDashboard();
    });

    endInput.addEventListener('change', (e) => {
      this.endDate = e.target.value;
      this.timePreset = 'CUSTOM';
      presetSelect.value = 'CUSTOM';
      this.updateDashboard();
    });

    this.container.querySelector('#dash-symbol-filter').addEventListener('change', (e) => {
      this.symbolFilter = e.target.value;
      this.updateDashboard();
    });

    this.container.querySelector('#dash-setup-filter').addEventListener('change', (e) => {
      this.setupFilter = e.target.value;
      this.updateDashboard();
    });
  }

  applyPresetToInputs() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const startInput = this.container.querySelector('#dash-start-date');
    const endInput = this.container.querySelector('#dash-end-date');

    if (this.timePreset === 'ALL') {
      this.startDate = '';
      this.endDate = '';
    } else if (this.timePreset === 'TODAY') {
      this.startDate = todayStr;
      this.endDate = todayStr;
    } else if (this.timePreset === 'YESTERDAY') {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      this.startDate = yStr;
      this.endDate = yStr;
    } else if (this.timePreset === 'THIS_WEEK') {
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      this.startDate = monday.toISOString().split('T')[0];
      this.endDate = todayStr;
    } else if (this.timePreset === 'LAST_WEEK') {
      const day = now.getDay() || 7;
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - day - 6);
      const lastSunday = new Date(now);
      lastSunday.setDate(now.getDate() - day);
      this.startDate = lastMonday.toISOString().split('T')[0];
      this.endDate = lastSunday.toISOString().split('T')[0];
    } else if (this.timePreset === 'THIS_MONTH') {
      this.startDate = `${todayStr.substring(0, 7)}-01`;
      this.endDate = todayStr;
    } else if (this.timePreset === 'LAST_MONTH') {
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      this.startDate = prevMonthDate.toISOString().split('T')[0];
      this.endDate = lastDayOfPrevMonth.toISOString().split('T')[0];
    } else if (this.timePreset === 'THIS_YEAR') {
      this.startDate = `${now.getFullYear()}-01-01`;
      this.endDate = todayStr;
    }

    startInput.value = this.startDate;
    endInput.value = this.endDate;
  }

  populateFilterOptions() {
    const symbols = [...new Set(this.trades.map(t => t.symbol).filter(Boolean))].sort();
    const setups = [...new Set(this.trades.map(t => t.setup).filter(Boolean))].sort();

    const symSelect = this.container.querySelector('#dash-symbol-filter');
    symbols.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      symSelect.appendChild(opt);
    });

    const setupSelect = this.container.querySelector('#dash-setup-filter');
    setups.forEach(st => {
      const opt = document.createElement('option');
      opt.value = st;
      opt.textContent = st;
      setupSelect.appendChild(opt);
    });
  }

  getFilteredTrades() {
    return this.trades.filter(t => {
      // 1. Time Interval Filter
      if (this.startDate && t.date < this.startDate) return false;
      if (this.endDate && t.date > this.endDate) return false;

      // 2. Symbol Filter
      if (this.symbolFilter !== 'ALL' && t.symbol !== this.symbolFilter) {
        return false;
      }

      // 3. Setup Filter
      if (this.setupFilter !== 'ALL' && t.setup !== this.setupFilter) {
        return false;
      }

      return true;
    });
  }

  updateDashboard() {
    const filtered = this.getFilteredTrades();
    const countEl = this.container.querySelector('#dash-filtered-count');
    if (countEl) countEl.textContent = `Showing ${filtered.length} of ${this.trades.length} trades`;

    const dashBody = this.container.querySelector('#dash-body');

    if (this.trades.length === 0) {
      dashBody.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 28px; opacity: 0.6;">📊</div>
          <div class="empty-state-title">No live trading data yet</div>
          <div class="empty-state-desc">Start adding executions in the Live Journal to track R, Profit Factor, Mistakes, and Equity curves.</div>
        </div>
      `;
      return;
    }

    const metrics = aggregateMetrics(filtered);

    dashBody.innerHTML = `
      ${metrics.openTradesCount > 0 ? `
        <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 700; color: #1D4ED8; font-size: 13px;">⚡ ${metrics.openTradesCount} Active Position${metrics.openTradesCount > 1 ? 's' : ''} Running (持仓中)</span>
            <span style="font-size: 11.5px; color: #3B82F6;">Total Open Risk: -$${metrics.openRiskTotal.toFixed(2)}</span>
          </div>
          <button class="btn btn-sm btn-primary" id="btn-dash-view-open" style="padding: 4px 10px; font-size: 11px; font-weight: 700;">
            View & Close Open Trades →
          </button>
        </div>
      ` : ''}

      <!-- VEYRA Execution & Discipline Bar -->
      <div style="background: var(--surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 14px; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px;">
        <div>
          <div style="font-size: 10px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600;">Plan Adherence</div>
          <div style="font-size: 16px; font-weight: 700; color: ${metrics.planAdherenceRate >= 80 ? 'var(--profit-color)' : 'var(--loss-color)'}; font-family: var(--font-mono);">
            ${metrics.planAdherenceRate.toFixed(1)}%
          </div>
          <div style="font-size: 10.5px; color: var(--text-secondary);">${metrics.followedPlanCount} Followed / ${metrics.brokePlanCount} Broken</div>
        </div>

        <div>
          <div style="font-size: 10px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600;">Cost of Mistakes</div>
          <div style="font-size: 16px; font-weight: 700; color: var(--loss-color); font-family: var(--font-mono);">
            -${formatCurrency(metrics.costOfMistakes, false)}
          </div>
          <div style="font-size: 10.5px; color: var(--text-secondary);">${metrics.mistakeTradesCount} Trades with mistakes</div>
        </div>

        <div>
          <div style="font-size: 10px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600;">P&L Without Mistakes</div>
          <div style="font-size: 16px; font-weight: 700; color: ${getMetricColorClass(metrics.pnlWithoutMistakes)}; font-family: var(--font-mono);">
            ${formatCurrency(metrics.pnlWithoutMistakes)}
          </div>
          <div style="font-size: 10.5px; color: var(--text-secondary);">Potential disciplined edge</div>
        </div>

        <div>
          <div style="font-size: 10px; color: var(--text-tertiary); text-transform: uppercase; font-weight: 600;">Payoff Ratio (Win/Loss)</div>
          <div style="font-size: 16px; font-weight: 700; color: var(--text-main); font-family: var(--font-mono);">
            ${metrics.payoffRatio !== null ? metrics.payoffRatio.toFixed(2) : 'N/A'}
          </div>
          <div style="font-size: 10.5px; color: var(--text-secondary);">Avg Win / Avg Loss size</div>
        </div>
      </div>

      <!-- 1. KPI Cards Row (Pure $ and R) -->
      <div id="dash-kpi-container" style="margin-bottom: 16px;"></div>

      <!-- 2. Charts Row: Equity Curve + Daily P&L -->
      <div class="charts-row" style="margin-bottom: 16px;">
        <div class="chart-card">
          <div class="chart-card-header">
            <div class="chart-card-title">Equity Curve [${this.unit}]</div>
            <div style="font-size: 11px; color: var(--text-tertiary);">Cumulative Performance</div>
          </div>
          <div class="chart-svg-container" id="dash-equity-chart"></div>
        </div>

        <div class="chart-card">
          <div class="chart-card-header">
            <div class="chart-card-title">Daily P&L [${this.unit}]</div>
            <div style="font-size: 11px; color: var(--text-tertiary);">Day by Day Distribution</div>
          </div>
          <div class="chart-svg-container" id="dash-daily-chart"></div>
        </div>
      </div>

      <!-- 3. VEYRA R-Multiple Distribution Chart -->
      <div class="chart-card" style="margin-bottom: 16px;">
        <div class="chart-card-header">
          <div class="chart-card-title">R-Multiple Distribution (Outcome Skew)</div>
          <div style="font-size: 11px; color: var(--text-tertiary);">Risk-normalized outcome frequency</div>
        </div>
        <div class="chart-svg-container" id="dash-rdist-chart"></div>
      </div>

      <!-- 4. Calendar View -->
      <div id="dash-calendar-container"></div>
    `;

    // 渲染 KPI Cards
    const kpiHost = dashBody.querySelector('#dash-kpi-container');
    new MetricCards({
      container: kpiHost,
      metrics,
      unit: this.unit
    });

    // 渲染 Equity Curve
    const equityHost = dashBody.querySelector('#dash-equity-chart');
    new EquityCurveChart({
      container: equityHost,
      curveData: metrics.cumulativeCurve,
      unit: this.unit
    });

    // 渲染 Daily P&L
    const dailyHost = dashBody.querySelector('#dash-daily-chart');
    new DailyPnlChart({
      container: dailyHost,
      dailyDistribution: metrics.dailyDistribution,
      unit: this.unit
    });

    // 渲染 R Distribution
    const rDistHost = dashBody.querySelector('#dash-rdist-chart');
    new RDistributionChart({
      container: rDistHost,
      rDistribution: metrics.rDistribution
    });

    // 渲染 Calendar
    const calHost = dashBody.querySelector('#dash-calendar-container');
    new TradingCalendar({
      container: calHost,
      dailyDistribution: metrics.dailyDistribution,
      unit: this.unit
    });

    const btnViewOpen = dashBody.querySelector('#btn-dash-view-open');
    if (btnViewOpen) {
      btnViewOpen.addEventListener('click', () => {
        const tradesNav = document.querySelector('[data-route="live-journal"]');
        if (tradesNav) tradesNav.click();
      });
    }
  }
}
