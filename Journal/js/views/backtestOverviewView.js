/**
 * backtestOverviewView.js
 * 跨全部 Backtest Books 的综合全景看板（纯净 P&L/R 计算，配备 Time Interval Filter）：
 * 彻底不依赖 account balance，支持起止日期区间、Book、Strategy、Symbol 组合过滤。
 */

import { BacktestRepo } from '../db/backtestRepo.js';
import { aggregateMetrics } from '../core/calculations.js';
import { MetricCards } from '../components/metricCards.js';
import { EquityCurveChart, DailyPnlChart } from '../components/charts.js';

export class BacktestOverviewView {
  constructor(options = {}) {
    this.container = options.container;
    this.books = [];
    this.allBtTrades = [];
    this.unit = '$';
    this.startDate = '';
    this.endDate = '';
    this.bookFilter = 'ALL';
    this.strategyFilter = 'ALL';
    this.symbolFilter = 'ALL';
  }

  async render() {
    this.container.innerHTML = `
      <div class="backtest-mode-banner">
        <div>
          Aggregated Backtesting Overview — Pure P&L & R metrics (Zero Live data included).
        </div>
      </div>

      <div class="view-header">
        <div class="header-left">
          <div class="view-title">Backtest Overview</div>
        </div>
        <div class="header-right">
          <!-- Metric Unit Toggle: Pure $ and R -->
          <div class="unit-toggle-group">
            <button class="unit-btn ${this.unit === '$' ? 'active' : ''}" data-unit="$">$ (Cash)</button>
            <button class="unit-btn ${this.unit === 'R' ? 'active' : ''}" data-unit="R">R (Risk Multiple)</button>
          </div>
        </div>
      </div>

      <div class="view-content" id="bt-overview-content">
        <!-- Interval & Dimensions Toolbar -->
        <div class="table-toolbar" style="background: var(--surface); padding: 10px 14px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Interval:</span>
              <input type="date" class="table-select" id="bto-start-date" value="${this.startDate}">
              <span style="color: var(--text-tertiary); font-size: 11px;">to</span>
              <input type="date" class="table-select" id="bto-end-date" value="${this.endDate}">
            </div>

            <div style="width: 1px; height: 18px; background: var(--border-subtle); margin: 0 4px;"></div>

            <select class="table-select" id="bto-book-filter">
              <option value="ALL">All Backtest Books</option>
            </select>
            <select class="table-select" id="bto-strategy-filter">
              <option value="ALL">All Strategies</option>
            </select>
            <select class="table-select" id="bto-symbol-filter">
              <option value="ALL">All Symbols</option>
            </select>
          </div>
          <div style="font-size: 11.5px; color: var(--text-tertiary);" id="bto-status-summary">
            Loaded 0 books
          </div>
        </div>

        <div id="bto-body"></div>
      </div>
    `;

    await this.loadData();
    this.bindEvents();
  }

  async loadData() {
    this.books = await BacktestRepo.getAllBooks();
    this.allBtTrades = await BacktestRepo.getAllBacktestTrades();

    this.populateFilters();
    this.updateOverview();
  }

  populateFilters() {
    const bookSelect = this.container.querySelector('#bto-book-filter');
    const stratSelect = this.container.querySelector('#bto-strategy-filter');
    const symSelect = this.container.querySelector('#bto-symbol-filter');

    bookSelect.innerHTML = '<option value="ALL">All Backtest Books</option>';
    stratSelect.innerHTML = '<option value="ALL">All Strategies</option>';
    symSelect.innerHTML = '<option value="ALL">All Symbols</option>';

    this.books.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.name;
      bookSelect.appendChild(opt);
    });

    const strategies = [...new Set(this.books.map(b => b.strategy).filter(Boolean))].sort();
    strategies.forEach(st => {
      const opt = document.createElement('option');
      opt.value = st;
      opt.textContent = st;
      stratSelect.appendChild(opt);
    });

    const symbols = [...new Set(this.allBtTrades.map(t => t.symbol).filter(Boolean))].sort();
    symbols.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      symSelect.appendChild(opt);
    });
  }

  bindEvents() {
    this.container.querySelectorAll('.unit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.unit = btn.dataset.unit;
        this.updateOverview();
      });
    });

    this.container.querySelector('#bto-start-date').addEventListener('change', (e) => {
      this.startDate = e.target.value;
      this.updateOverview();
    });

    this.container.querySelector('#bto-end-date').addEventListener('change', (e) => {
      this.endDate = e.target.value;
      this.updateOverview();
    });

    this.container.querySelector('#bto-book-filter').addEventListener('change', (e) => {
      this.bookFilter = e.target.value;
      this.updateOverview();
    });

    this.container.querySelector('#bto-strategy-filter').addEventListener('change', (e) => {
      this.strategyFilter = e.target.value;
      this.updateOverview();
    });

    this.container.querySelector('#bto-symbol-filter').addEventListener('change', (e) => {
      this.symbolFilter = e.target.value;
      this.updateOverview();
    });
  }

  getFilteredTrades() {
    const bookMap = {};
    this.books.forEach(b => { bookMap[b.id] = b; });

    return this.allBtTrades.filter(t => {
      if (this.startDate && t.date < this.startDate) return false;
      if (this.endDate && t.date > this.endDate) return false;

      if (this.bookFilter !== 'ALL' && t.book_id !== this.bookFilter) {
        return false;
      }

      if (this.strategyFilter !== 'ALL') {
        const b = bookMap[t.book_id];
        if (!b || b.strategy !== this.strategyFilter) return false;
      }

      if (this.symbolFilter !== 'ALL' && t.symbol !== this.symbolFilter) {
        return false;
      }

      return true;
    });
  }

  updateOverview() {
    const filteredTrades = this.getFilteredTrades();


    const summaryEl = this.container.querySelector('#bto-status-summary');
    if (summaryEl) {
      summaryEl.textContent = `${this.books.length} Books | ${filteredTrades.length} Trades Filtered`;
    }

    const btoBody = this.container.querySelector('#bto-body');

    if (this.allBtTrades.length === 0) {
      btoBody.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 28px; opacity: 0.6;">📈</div>
          <div class="empty-state-title">No backtest trades recorded yet</div>
          <div class="empty-state-desc">Create Backtest Books and log trades to aggregate multi-model statistics here.</div>
        </div>
      `;
      return;
    }

    const metrics = aggregateMetrics(filteredTrades);

    btoBody.innerHTML = `
      <!-- KPI Row (Pure $ and R) -->
      <div id="bto-kpi-container" style="margin-bottom: 16px;"></div>

      <!-- Charts Row -->
      <div class="charts-row">
        <div class="chart-card">
          <div class="chart-card-header">
            <div class="chart-card-title">Aggregated Backtest Equity [${this.unit}]</div>
          </div>
          <div class="chart-svg-container" id="bto-equity-chart"></div>
        </div>

        <div class="chart-card">
          <div class="chart-card-header">
            <div class="chart-card-title">Backtest Daily P&L [${this.unit}]</div>
          </div>
          <div class="chart-svg-container" id="bto-daily-chart"></div>
        </div>
      </div>
    `;

    // 渲染 KPI Cards
    const kpiHost = btoBody.querySelector('#bto-kpi-container');
    new MetricCards({
      container: kpiHost,
      metrics,
      unit: this.unit
    });

    // 渲染 Equity Curve
    const equityHost = btoBody.querySelector('#bto-equity-chart');
    new EquityCurveChart({
      container: equityHost,
      curveData: metrics.cumulativeCurve,
      unit: this.unit
    });

    // 渲染 Daily P&L
    const dailyHost = btoBody.querySelector('#bto-daily-chart');
    new DailyPnlChart({
      container: dailyHost,
      dailyDistribution: metrics.dailyDistribution,
      unit: this.unit
    });
  }
}
