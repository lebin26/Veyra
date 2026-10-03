import { LiveRepo } from '../db/liveRepo.js';
import { aggregateMetrics } from '../core/calculations.js';
import { DashboardKpiCards } from '../components/metricCards.js';
import { CumulativeAreaChart, DailyPnlChart, ZellaRadarChart } from '../components/charts.js';
import { TradingCalendar } from '../components/calendar.js';
import { DailyDetailModal } from '../components/dailyDetailModal.js';
import { formatCurrency, formatPercent, getMetricColorClass } from '../core/formatters.js';

export class LiveDashboardView {
  constructor(options = {}) {
    this.container = options.container;
    this.trades = [];
    this.unit = '$'; // '$' | 'R'
    this.timePreset = 'ALL';
    this.startDate = '';
    this.endDate = '';
    this.accountFilter = 'ALL';
    this.symbolFilter = 'ALL';
    this.setupFilter = 'ALL';
  }

  async render() {
    this.trades = await LiveRepo.getAllTrades();

    this.container.innerHTML = `
      <div class="view-header" style="padding: 16px 24px; border-bottom: 1px solid var(--border-default); background: var(--bg-panel); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div class="header-left" style="display: flex; align-items: center; gap: 12px;">
          <h1 class="view-title" style="font-size: 20px; font-weight: 700; margin: 0; color: var(--text-primary); letter-spacing: -0.02em;">Dashboard</h1>
          <span style="font-size: 11.5px; color: var(--text-secondary); background: var(--fill-subtle); padding: 3px 8px; border-radius: var(--radius-chip);" id="dash-trade-count-badge">
            ${this.trades.length} Trades
          </span>
        </div>
        
        <!-- Top Toolbar Right Controls -->
        <div class="header-right" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <!-- Metric Unit Toggle -->
          <div class="segmented-control" style="display: flex; background: var(--fill-subtle); padding: 2px; border-radius: var(--radius-control); border: 1px solid var(--border-default);">
            <button type="button" class="unit-btn ${this.unit === '$' ? 'active' : ''}" data-unit="$" style="padding: 4px 10px; font-size: 11px; font-weight: 600; border: none; border-radius: 6px; background: ${this.unit === '$' ? 'var(--bg-panel)' : 'transparent'}; color: var(--text-primary); cursor: pointer; box-shadow: ${this.unit === '$' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'};">$ Cash</button>
            <button type="button" class="unit-btn ${this.unit === 'R' ? 'active' : ''}" data-unit="R" style="padding: 4px 10px; font-size: 11px; font-weight: 600; border: none; border-radius: 6px; background: ${this.unit === 'R' ? 'var(--bg-panel)' : 'transparent'}; color: var(--text-primary); cursor: pointer; box-shadow: ${this.unit === 'R' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'};">R Multiplier</button>
          </div>

          <!-- Account Selector -->
          <select class="table-select" id="dash-account-filter" style="padding: 5px 10px; font-size: 11.5px; font-weight: 600; background: var(--bg-panel); border: 1px solid var(--border-default); border-radius: var(--radius-control); color: var(--text-primary);">
            <option value="ALL">All Accounts</option>
          </select>

          <!-- Date Range Selector -->
          <select class="table-select" id="dash-time-preset" style="padding: 5px 10px; font-size: 11.5px; font-weight: 600; background: var(--bg-panel); border: 1px solid var(--border-default); border-radius: var(--radius-control); color: var(--text-primary);">
            <option value="ALL" ${this.timePreset === 'ALL' ? 'selected' : ''}>All Dates</option>
            <option value="TODAY" ${this.timePreset === 'TODAY' ? 'selected' : ''}>Today</option>
            <option value="YESTERDAY" ${this.timePreset === 'YESTERDAY' ? 'selected' : ''}>Yesterday</option>
            <option value="THIS_WEEK" ${this.timePreset === 'THIS_WEEK' ? 'selected' : ''}>This Week</option>
            <option value="LAST_WEEK" ${this.timePreset === 'LAST_WEEK' ? 'selected' : ''}>Last Week</option>
            <option value="THIS_MONTH" ${this.timePreset === 'THIS_MONTH' ? 'selected' : ''}>This Month</option>
            <option value="LAST_MONTH" ${this.timePreset === 'LAST_MONTH' ? 'selected' : ''}>Last Month</option>
            <option value="THIS_YEAR" ${this.timePreset === 'THIS_YEAR' ? 'selected' : ''}>This Year</option>
            <option value="CUSTOM" ${this.timePreset === 'CUSTOM' ? 'selected' : ''}>Custom Range</option>
          </select>

          <!-- Symbol Filter -->
          <select class="table-select" id="dash-symbol-filter" style="padding: 5px 10px; font-size: 11.5px; background: var(--bg-panel); border: 1px solid var(--border-default); border-radius: var(--radius-control); color: var(--text-primary);">
            <option value="ALL">All Symbols</option>
          </select>

          <!-- Setup Filter -->
          <select class="table-select" id="dash-setup-filter" style="padding: 5px 10px; font-size: 11.5px; background: var(--bg-panel); border: 1px solid var(--border-default); border-radius: var(--radius-control); color: var(--text-primary);">
            <option value="ALL">All Playbooks</option>
          </select>
        </div>
      </div>

      <div class="view-content" id="dashboard-content" style="padding: 20px 24px; display: flex; flex-direction: column; gap: 18px; max-width: 1400px; margin: 0 auto; width: 100%;">
        <!-- Row 1: 5 KPI Cards -->
        <div id="dash-kpi-container"></div>

        <!-- Row 2: 3 Analytics Charts (Zella Score Radar | Cumulative P&L Area | Daily P&L Bars) -->
        <div style="display: grid; grid-template-columns: 320px 1.4fr 1.2fr; gap: 14px; align-items: stretch;" id="dash-charts-row">
          <!-- Card 1: Zella Score Radar Chart -->
          <div class="chart-card" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div class="chart-card-header">
              <div class="chart-card-title">Zella Score</div>
              <div style="font-size: 10.5px; color: var(--text-tertiary);">Quantitative Index</div>
            </div>
            <div id="dash-zella-radar-container" style="flex: 1; display: flex; align-items: center; justify-content: center; min-height: 220px;"></div>
          </div>

          <!-- Card 2: Cumulative Area Chart -->
          <div class="chart-card" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div class="chart-card-header">
              <div class="chart-card-title">Daily Net Cumulative P&L [${this.unit}]</div>
              <div style="font-size: 10.5px; color: var(--text-tertiary);">Historical Equity Curve</div>
            </div>
            <div class="chart-svg-container" id="dash-cumulative-chart" style="flex: 1; min-height: 220px;"></div>
          </div>

          <!-- Card 3: Daily P&L Bars -->
          <div class="chart-card" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div class="chart-card-header">
              <div class="chart-card-title">Net Daily P&L [${this.unit}]</div>
              <div style="font-size: 10.5px; color: var(--text-tertiary);">Day Win/Loss Distribution</div>
            </div>
            <div class="chart-svg-container" id="dash-daily-chart" style="flex: 1; min-height: 220px;"></div>
          </div>
        </div>

        <!-- Row 3: Open Positions + Trading Calendar -->
        <div style="display: grid; grid-template-columns: 380px 1fr; gap: 14px; align-items: start;" id="dash-bottom-row">
          <!-- Open Positions Table Card -->
          <div class="chart-card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column; height: 100%;">
            <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-default); display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-primary);">Open Positions</span>
              <span style="font-size: 10.5px; color: var(--text-secondary);" id="open-positions-count">0 Active</span>
            </div>
            <div id="dash-open-positions-body" style="flex: 1; overflow-x: auto; max-height: 380px;"></div>
          </div>

          <!-- Trading Calendar Heatmap & Weekly Stats -->
          <div id="dash-calendar-container"></div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.populateFilterOptions();
    this.updateDashboard();
  }

  bindEvents() {
    this.container.querySelectorAll('.unit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.unit-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.boxShadow = 'none';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--bg-panel)';
        btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
        this.unit = btn.dataset.unit;
        this.updateDashboard();
      });
    });

    const presetSelect = this.container.querySelector('#dash-time-preset');
    presetSelect.addEventListener('change', (e) => {
      this.timePreset = e.target.value;
      this.applyPresetDates();
      this.updateDashboard();
    });

    const symSelect = this.container.querySelector('#dash-symbol-filter');
    symSelect.addEventListener('change', (e) => {
      this.symbolFilter = e.target.value;
      this.updateDashboard();
    });

    const setupSelect = this.container.querySelector('#dash-setup-filter');
    setupSelect.addEventListener('change', (e) => {
      this.setupFilter = e.target.value;
      this.updateDashboard();
    });

    const accSelect = this.container.querySelector('#dash-account-filter');
    accSelect.addEventListener('change', (e) => {
      this.accountFilter = e.target.value;
      this.updateDashboard();
    });
  }

  applyPresetDates() {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (this.timePreset === 'ALL') {
      this.startDate = '';
      this.endDate = '';
    } else if (this.timePreset === 'TODAY') {
      this.startDate = todayStr;
      this.endDate = todayStr;
    } else if (this.timePreset === 'YESTERDAY') {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      this.startDate = y.toISOString().split('T')[0];
      this.endDate = this.startDate;
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
  }

  populateFilterOptions() {
    const symbols = [...new Set(this.trades.map(t => t.symbol).filter(Boolean))].sort();
    const setups = [...new Set(this.trades.map(t => t.setup).filter(Boolean))].sort();
    const accounts = [...new Set(this.trades.map(t => t.account || t.broker).filter(Boolean))].sort();

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

    const accSelect = this.container.querySelector('#dash-account-filter');
    accounts.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc;
      opt.textContent = acc;
      accSelect.appendChild(opt);
    });
  }

  getFilteredTrades() {
    return this.trades.filter(t => {
      if (this.startDate && t.date < this.startDate) return false;
      if (this.endDate && t.date > this.endDate) return false;
      if (this.symbolFilter !== 'ALL' && t.symbol !== this.symbolFilter) return false;
      if (this.setupFilter !== 'ALL' && t.setup !== this.setupFilter) return false;
      if (this.accountFilter !== 'ALL' && (t.account !== this.accountFilter && t.broker !== this.accountFilter)) return false;
      return true;
    });
  }

  updateDashboard() {
    const filtered = this.getFilteredTrades();
    const metrics = aggregateMetrics(filtered);

    // 1. Render 5 KPI Cards
    const kpiHost = this.container.querySelector('#dash-kpi-container');
    new DashboardKpiCards({
      container: kpiHost,
      metrics,
      unit: this.unit
    });

    // 2. Render Zella Radar Chart
    const zellaHost = this.container.querySelector('#dash-zella-radar-container');
    new ZellaRadarChart({
      container: zellaHost,
      metrics
    });

    // 3. Render Cumulative Area Chart
    const cumHost = this.container.querySelector('#dash-cumulative-chart');
    new CumulativeAreaChart({
      container: cumHost,
      curveData: metrics.cumulativeCurve,
      unit: this.unit
    });

    // 4. Render Net Daily P&L Chart
    const dailyHost = this.container.querySelector('#dash-daily-chart');
    new DailyPnlChart({
      container: dailyHost,
      dailyDistribution: metrics.dailyDistribution,
      unit: this.unit
    });

    // 5. Render Open Positions Table
    this.renderOpenPositions(this.trades.filter(t => t.status === 'OPEN' || !t.closePrice));

    // 6. Render Monthly Heatmap Calendar with Weekly Summary & Day Click Modal
    const calHost = this.container.querySelector('#dash-calendar-container');
    new TradingCalendar({
      container: calHost,
      dailyDistribution: metrics.dailyDistribution,
      allTrades: filtered,
      unit: this.unit,
      onSelectDate: (dateKey) => {
        const dayTrades = filtered.filter(t => (t.date === dateKey || (t.openTime && t.openTime.startsWith(dateKey))));
        const dayData = metrics.dailyDistribution[dateKey] || { pnl: 0, r: 0, trades: dayTrades.length };
        new DailyDetailModal({
          date: dateKey,
          trades: dayTrades,
          dailyData: dayData,
          onNoteSave: () => {}
        });
      }
    });
  }

  renderOpenPositions(openTrades = []) {
    const container = this.container.querySelector('#dash-open-positions-body');
    const countBadge = this.container.querySelector('#open-positions-count');
    if (!container) return;

    if (countBadge) countBadge.textContent = `${openTrades.length} Active`;

    if (openTrades.length === 0) {
      container.innerHTML = `
        <div style="padding: 32px 16px; text-align: center; color: var(--text-tertiary); font-size: 11.5px;">
          No open positions currently running
        </div>
      `;
      return;
    }

    const rowsHtml = openTrades.map(t => {
      const isLong = (t.direction || t.side || '').toUpperCase() === 'LONG';
      const sideColor = isLong ? 'var(--color-profit)' : 'var(--color-loss)';
      const pnl = t.unrealizedPnl !== undefined ? t.unrealizedPnl : (t.pnl || 0);
      const pnlColorClass = getMetricColorClass(pnl);
      const roi = t.roi !== undefined ? t.roi : (t.returnPercent || 0);

      return `
        <tr style="border-bottom: 1px solid var(--border-default); font-size: 11px;">
          <td style="padding: 8px 12px; color: var(--text-secondary);">${t.date || '—'}</td>
          <td style="padding: 8px 12px; font-weight: 700; color: var(--text-primary);">${t.symbol || '—'}</td>
          <td style="padding: 8px 12px;">
            <span style="font-size: 9.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${isLong ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${sideColor};">
              ${isLong ? 'LONG' : 'SHORT'}
            </span>
          </td>
          <td style="padding: 8px 12px; text-align: right; font-family: var(--font-mono);">${t.size || t.quantity || 1}</td>
          <td style="padding: 8px 12px; text-align: right; font-family: var(--font-mono);">${t.entryPrice ? Number(t.entryPrice).toFixed(2) : '—'}</td>
          <td style="padding: 8px 12px; text-align: right; font-family: var(--font-mono);" class="${pnlColorClass}">${formatCurrency(pnl)}</td>
          <td style="padding: 8px 12px; text-align: right; font-family: var(--font-mono);">${formatPercent(roi)}</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-default); font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary); background: var(--fill-subtle);">
            <th style="padding: 8px 12px;">Date</th>
            <th style="padding: 8px 12px;">Symbol</th>
            <th style="padding: 8px 12px;">Side</th>
            <th style="padding: 8px 12px; text-align: right;">Qty</th>
            <th style="padding: 8px 12px; text-align: right;">Entry</th>
            <th style="padding: 8px 12px; text-align: right;">Unrealized</th>
            <th style="padding: 8px 12px; text-align: right;">ROI</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  }
}

