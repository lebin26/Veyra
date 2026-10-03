/**
 * reportsView.js
 * Multi-dimensional Quantitative Reports Center (PDF Pages 3 & 4, PRD 39-53):
 * - Left Navigation: Overview, Days, Weeks, Months, Trade time, Trade duration, Price, Volume, Instrument, Options
 * - Top Toolbar: P&L Showing toggle (Net P&L, Gross P&L, ROI, R-Multiple), Time Range & Filters
 * - Overview: YOUR STATS, 2-column Comprehensive Metric Table, Cumulative Area Chart, Daily P&L Bars
 * - Days: Day-of-week Distribution & Performance charts + Summary Table
 * - Instrument: Top 10 Symbols Distribution & Performance charts + Summary Table
 */

import { LiveRepo } from '../db/liveRepo.js';
import { aggregateMetrics } from '../core/calculations.js';
import { CumulativeAreaChart, DailyPnlChart, HorizontalBarChart } from '../components/charts.js';
import { formatCurrency, formatR, formatPercent, getMetricColorClass } from '../core/formatters.js';

export class ReportsView {
  constructor(options = {}) {
    this.container = options.container;
    this.trades = [];
    this.activeReport = 'overview'; // 'overview', 'days', 'weeks', 'months', 'tradetime', 'duration', 'price', 'volume', 'instrument', 'options'
    this.pnlShowing = 'NET_PNL'; // 'NET_PNL', 'GROSS_PNL', 'ROI', 'R'
    this.timePreset = 'ALL';
    this.accountFilter = 'ALL';
    this.metrics = {};
  }

  async render() {
    this.trades = await LiveRepo.getAllTrades();
    this.metrics = aggregateMetrics(this.trades);

    this.container.innerHTML = `
      <div class="view-header" style="padding: 16px 24px; border-bottom: 1px solid var(--border-default); background: var(--bg-panel); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div class="header-left" style="display: flex; align-items: center; gap: 12px;">
          <h1 class="view-title" style="font-size: 20px; font-weight: 700; margin: 0; color: var(--text-primary); letter-spacing: -0.02em;">Reports</h1>
        </div>
        
        <div class="header-right" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <!-- P&L Showing Selector -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">P&L Showing:</span>
            <select class="table-select" id="report-pnl-showing" style="padding: 5px 10px; font-size: 11.5px; font-weight: 600; background: var(--bg-panel); border: 1px solid var(--border-default); border-radius: var(--radius-control); color: var(--text-primary);">
              <option value="NET_PNL" ${this.pnlShowing === 'NET_PNL' ? 'selected' : ''}>Net P&L</option>
              <option value="GROSS_PNL" ${this.pnlShowing === 'GROSS_PNL' ? 'selected' : ''}>Gross P&L</option>
              <option value="ROI" ${this.pnlShowing === 'ROI' ? 'selected' : ''}>Net ROI %</option>
              <option value="R" ${this.pnlShowing === 'R' ? 'selected' : ''}>R-Multiple</option>
            </select>
          </div>

          <!-- Date Range Selector -->
          <select class="table-select" id="report-date-range" style="padding: 5px 10px; font-size: 11.5px; font-weight: 600; background: var(--bg-panel); border: 1px solid var(--border-default); border-radius: var(--radius-control); color: var(--text-primary);">
            <option value="ALL">All Dates</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="LAST_MONTH">Last Month</option>
            <option value="THIS_YEAR">This Year</option>
          </select>

          <!-- Accounts Selector -->
          <select class="table-select" id="report-account-filter" style="padding: 5px 10px; font-size: 11.5px; background: var(--bg-panel); border: 1px solid var(--border-default); border-radius: var(--radius-control); color: var(--text-primary);">
            <option value="ALL">All Accounts</option>
          </select>
        </div>
      </div>

      <!-- Main Layout: Left Navigation + Right Content -->
      <div style="display: grid; grid-template-columns: 210px 1fr; min-height: calc(100vh - 120px);">
        <!-- Left Sidebar Navigation -->
        <div style="background: var(--bg-panel); border-right: 1px solid var(--border-default); padding: 16px 12px; display: flex; flex-direction: column; gap: 16px;">
          <!-- Overview Tab -->
          <button type="button" class="report-nav-item ${this.activeReport === 'overview' ? 'active' : ''}" data-report="overview">
            <span style="font-size: 13px;">▦</span> Overview
          </button>

          <!-- Section: Date & Time -->
          <div>
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.5px; padding: 4px 8px; margin-bottom: 2px;">
              Date & Time
            </div>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <button type="button" class="report-nav-item ${this.activeReport === 'days' ? 'active' : ''}" data-report="days">Days</button>
              <button type="button" class="report-nav-item ${this.activeReport === 'weeks' ? 'active' : ''}" data-report="weeks">Weeks</button>
              <button type="button" class="report-nav-item ${this.activeReport === 'months' ? 'active' : ''}" data-report="months">Months</button>
              <button type="button" class="report-nav-item ${this.activeReport === 'tradetime' ? 'active' : ''}" data-report="tradetime">Trade time</button>
              <button type="button" class="report-nav-item ${this.activeReport === 'duration' ? 'active' : ''}" data-report="duration">Trade duration</button>
            </div>
          </div>

          <!-- Section: Price & Quantity -->
          <div>
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.5px; padding: 4px 8px; margin-bottom: 2px;">
              Price & Quantity
            </div>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <button type="button" class="report-nav-item ${this.activeReport === 'price' ? 'active' : ''}" data-report="price">Price</button>
              <button type="button" class="report-nav-item ${this.activeReport === 'volume' ? 'active' : ''}" data-report="volume">Volume</button>
              <button type="button" class="report-nav-item ${this.activeReport === 'instrument' ? 'active' : ''}" data-report="instrument">Instrument</button>
            </div>
          </div>

          <!-- Section: Options -->
          <div>
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 0.5px; padding: 4px 8px; margin-bottom: 2px;">
              Options
            </div>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <button type="button" class="report-nav-item ${this.activeReport === 'options' ? 'active' : ''}" data-report="options">Days till expiration</button>
            </div>
          </div>
        </div>

        <!-- Right Content Area -->
        <div id="report-main-content" style="padding: 24px; background: var(--bg-page); overflow-y: auto;"></div>
      </div>
    `;

    this.bindEvents();
    this.renderCurrentReport();
  }

  bindEvents() {
    this.container.querySelectorAll('.report-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.report-nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeReport = btn.dataset.report;
        this.renderCurrentReport();
      });
    });

    const pnlSelect = this.container.querySelector('#report-pnl-showing');
    if (pnlSelect) {
      pnlSelect.addEventListener('change', (e) => {
        this.pnlShowing = e.target.value;
        this.renderCurrentReport();
      });
    }
  }

  renderCurrentReport() {
    const host = this.container.querySelector('#report-main-content');
    if (!host) return;

    if (this.activeReport === 'overview') {
      this.renderOverviewReport(host);
    } else if (this.activeReport === 'days') {
      this.renderDaysReport(host);
    } else if (this.activeReport === 'instrument') {
      this.renderInstrumentReport(host);
    } else if (this.activeReport === 'weeks' || this.activeReport === 'months') {
      this.renderPeriodsReport(host, this.activeReport);
    } else {
      this.renderGenericDimensionReport(host, this.activeReport);
    }
  }

  renderOverviewReport(host) {
    const m = this.metrics;

    // Monthly breakdown to deduce Best Month / Lowest Month / Average
    const monthlyTotals = {};
    this.trades.forEach(t => {
      const monthKey = (t.date || '').substring(0, 7);
      if (monthKey) {
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + (t.pnl || 0);
      }
    });

    const monthVals = Object.values(monthlyTotals);
    const bestMonth = monthVals.length > 0 ? Math.max(...monthVals) : 0;
    const lowestMonth = monthVals.length > 0 ? Math.min(...monthVals) : 0;
    const avgMonth = monthVals.length > 0 ? monthVals.reduce((a, b) => a + b, 0) / monthVals.length : 0;

    host.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px; max-width: 1200px; margin: 0 auto;">
        <!-- YOUR STATS Row -->
        <div>
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px; margin-bottom: 8px;">
            YOUR STATS <span style="font-size: 10px; color: var(--text-tertiary); font-weight: normal;">(ALL DATES)</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;">
            <div class="kpi-card" style="padding: 12px 16px;">
              <div style="font-size: 11px; color: var(--text-secondary);">Best Month</div>
              <div style="font-size: 20px; font-weight: 700; font-family: var(--font-mono); color: var(--color-profit); margin-top: 4px;">
                ${formatCurrency(bestMonth)}
              </div>
            </div>
            <div class="kpi-card" style="padding: 12px 16px;">
              <div style="font-size: 11px; color: var(--text-secondary);">Lowest Month</div>
              <div style="font-size: 20px; font-weight: 700; font-family: var(--font-mono); color: var(--color-loss); margin-top: 4px;">
                ${formatCurrency(lowestMonth)}
              </div>
            </div>
            <div class="kpi-card" style="padding: 12px 16px;">
              <div style="font-size: 11px; color: var(--text-secondary);">Average</div>
              <div style="font-size: 20px; font-weight: 700; font-family: var(--font-mono); color: var(--text-primary); margin-top: 4px;">
                ${formatCurrency(avgMonth)}
              </div>
            </div>
          </div>
        </div>

        <!-- Two-column Detailed Quantitative Metrics Table (PDF Page 3) -->
        <div class="chart-card" style="padding: 16px 20px;">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-primary); letter-spacing: 0.03em; margin-bottom: 12px; border-bottom: 1px solid var(--border-default); padding-bottom: 8px;">
            Core Performance Matrix
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px;">
            <!-- Left Column -->
            <table class="report-metrics-subtable">
              <tbody>
                <tr><td>Total P&L</td><td class="text-right font-mono ${getMetricColorClass(m.netPnl)}">${formatCurrency(m.netPnl)}</td></tr>
                <tr><td>Average Daily Volume</td><td class="text-right font-mono">${(m.totalTrades / Math.max(1, m.tradingDaysCount || 1)).toFixed(1)}</td></tr>
                <tr><td>Average Winning Trade</td><td class="text-right font-mono text-profit">${formatCurrency(m.averageWin)}</td></tr>
                <tr><td>Average Losing Trade</td><td class="text-right font-mono text-loss">-${formatCurrency(Math.abs(m.averageLoss))}</td></tr>
                <tr><td>Total Number of Trades</td><td class="text-right font-mono">${m.totalTrades || 0}</td></tr>
                <tr><td>Number of Winning Trades</td><td class="text-right font-mono">${m.winningTrades || 0}</td></tr>
                <tr><td>Number of Losing Trades</td><td class="text-right font-mono">${m.losingTrades || 0}</td></tr>
                <tr><td>Number of Break Even Trades</td><td class="text-right font-mono">${m.beTrades || 0}</td></tr>
                <tr><td>Max Consecutive Wins</td><td class="text-right font-mono">${m.winningStreak || 0}</td></tr>
                <tr><td>Max Consecutive Losses</td><td class="text-right font-mono">${m.losingStreak || 0}</td></tr>
                <tr><td>Total Commissions</td><td class="text-right font-mono">${formatCurrency(m.totalCommissions || 0)}</td></tr>
                <tr><td>Total Fees</td><td class="text-right font-mono">$0.00</td></tr>
                <tr><td>Profit Factor</td><td class="text-right font-mono">${m.profitFactor || 'N/A'}</td></tr>
              </tbody>
            </table>

            <!-- Right Column -->
            <table class="report-metrics-subtable">
              <tbody>
                <tr><td>Opened Trades</td><td class="text-right font-mono">${m.openTradesCount || 0}</td></tr>
                <tr><td>Total Trading Days</td><td class="text-right font-mono">${Object.keys(m.dailyDistribution || {}).length}</td></tr>
                <tr><td>Winning Days</td><td class="text-right font-mono text-profit">${Object.values(m.dailyDistribution || {}).filter(d => d.pnl > 0).length}</td></tr>
                <tr><td>Losing Days</td><td class="text-right font-mono text-loss">${Object.values(m.dailyDistribution || {}).filter(d => d.pnl < 0).length}</td></tr>
                <tr><td>Breakeven Days</td><td class="text-right font-mono">${Object.values(m.dailyDistribution || {}).filter(d => d.pnl === 0).length}</td></tr>
                <tr><td>Average Daily P&L</td><td class="text-right font-mono ${getMetricColorClass(m.netPnl / Math.max(1, Object.keys(m.dailyDistribution || {}).length))}">${formatCurrency(m.netPnl / Math.max(1, Object.keys(m.dailyDistribution || {}).length))}</td></tr>
                <tr><td>Average Realized R-Multiple</td><td class="text-right font-mono">${formatR(m.averageR)}</td></tr>
                <tr><td>Max Drawdown $</td><td class="text-right font-mono text-loss">${formatCurrency(-Math.abs(m.maxDrawdownAmount || 0))}</td></tr>
                <tr><td>Max Drawdown %</td><td class="text-right font-mono text-loss">${formatPercent(-(m.maxDrawdownPercent || 0))}</td></tr>
                <tr><td>Win Rate</td><td class="text-right font-mono">${(m.winRate || 0).toFixed(2)}%</td></tr>
                <tr><td>Plan Adherence Rate</td><td class="text-right font-mono">${(m.planAdherenceRate || 0).toFixed(1)}%</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 2 Side-by-Side Charts (PDF Page 4) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div class="chart-card">
            <div class="chart-card-header">
              <div class="chart-card-title">Daily Net Cumulative P&L</div>
            </div>
            <div class="chart-svg-container" id="report-overview-cum-chart"></div>
          </div>
          <div class="chart-card">
            <div class="chart-card-header">
              <div class="chart-card-title">Net Daily P&L</div>
            </div>
            <div class="chart-svg-container" id="report-overview-daily-chart"></div>
          </div>
        </div>
      </div>
    `;

    // Render charts
    const cumHost = host.querySelector('#report-overview-cum-chart');
    if (cumHost) {
      new CumulativeAreaChart({
        container: cumHost,
        curveData: m.cumulativeCurve,
        unit: '$'
      });
    }

    const dailyHost = host.querySelector('#report-overview-daily-chart');
    if (dailyHost) {
      new DailyPnlChart({
        container: dailyHost,
        dailyDistribution: m.dailyDistribution,
        unit: '$'
      });
    }
  }

  renderDaysReport(host) {
    const daysMap = {
      0: { label: 'Sunday', trades: 0, pnl: 0, wins: 0, losses: 0, grossWin: 0, grossLoss: 0, volume: 0 },
      1: { label: 'Monday', trades: 0, pnl: 0, wins: 0, losses: 0, grossWin: 0, grossLoss: 0, volume: 0 },
      2: { label: 'Tuesday', trades: 0, pnl: 0, wins: 0, losses: 0, grossWin: 0, grossLoss: 0, volume: 0 },
      3: { label: 'Wednesday', trades: 0, pnl: 0, wins: 0, losses: 0, grossWin: 0, grossLoss: 0, volume: 0 },
      4: { label: 'Thursday', trades: 0, pnl: 0, wins: 0, losses: 0, grossWin: 0, grossLoss: 0, volume: 0 },
      5: { label: 'Friday', trades: 0, pnl: 0, wins: 0, losses: 0, grossWin: 0, grossLoss: 0, volume: 0 },
      6: { label: 'Saturday', trades: 0, pnl: 0, wins: 0, losses: 0, grossWin: 0, grossLoss: 0, volume: 0 }
    };

    this.trades.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date);
      const dayIndex = d.getDay();
      const item = daysMap[dayIndex];
      if (item) {
        item.trades += 1;
        item.pnl += (t.pnl || 0);
        item.volume += (t.position_size || t.size || 1);
        if (t.pnl > 0) {
          item.wins += 1;
          item.grossWin += t.pnl;
        } else if (t.pnl < 0) {
          item.losses += 1;
          item.grossLoss += Math.abs(t.pnl);
        }
      }
    });

    const dayItems = Object.values(daysMap);

    host.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px; max-width: 1200px; margin: 0 auto;">
        <!-- Two Side-by-Side Charts (PDF Page 4) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <!-- Chart 1: Trade Distribution by Day of Week -->
          <div class="chart-card">
            <div class="chart-card-header">
              <div class="chart-card-title">Trade Distribution by Day of the Week</div>
            </div>
            <div id="report-days-dist-chart" style="padding: 10px 0;"></div>
          </div>

          <!-- Chart 2: Performance by Day of Week -->
          <div class="chart-card">
            <div class="chart-card-header">
              <div class="chart-card-title">Performance by Day of the Week</div>
            </div>
            <div id="report-days-perf-chart" style="padding: 10px 0;"></div>
          </div>
        </div>

        <!-- Summary Table (PDF Page 4) -->
        <div class="chart-card" style="padding: 0; overflow: hidden;">
          <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-default); font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary);">
            Summary
          </div>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 11.5px;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-default); font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary); background: var(--fill-subtle);">
                <th style="padding: 8px 14px;">Day</th>
                <th style="padding: 8px 14px; text-align: right;">Net Profits</th>
                <th style="padding: 8px 14px; text-align: right;">Winning %</th>
                <th style="padding: 8px 14px; text-align: right;">Total Profit</th>
                <th style="padding: 8px 14px; text-align: right;">Total Loss</th>
                <th style="padding: 8px 14px; text-align: right;">Trades</th>
                <th style="padding: 8px 14px; text-align: right;">Volume</th>
              </tr>
            </thead>
            <tbody>
              ${dayItems.map(d => {
                const winPct = d.trades > 0 ? (d.wins / d.trades) * 100 : 0;
                return `
                  <tr style="border-bottom: 1px solid var(--border-default);">
                    <td style="padding: 9px 14px; font-weight: 600; color: var(--text-primary);">${d.label}</td>
                    <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono);" class="${getMetricColorClass(d.pnl)}">${formatCurrency(d.pnl)}</td>
                    <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono);">${winPct.toFixed(2)}%</td>
                    <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono); color: var(--color-profit);">${formatCurrency(d.grossWin)}</td>
                    <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono); color: var(--color-loss);">-${formatCurrency(d.grossLoss)}</td>
                    <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono);">${d.trades}</td>
                    <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono);">${d.volume.toFixed(1)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Render distribution
    const distHost = host.querySelector('#report-days-dist-chart');
    new HorizontalBarChart({
      container: distHost,
      items: dayItems.map(d => ({ label: d.label, value: d.trades })),
      valueKey: 'value',
      isCurrency: false,
      barColor: '#5B55D9'
    });

    // Render performance
    const perfHost = host.querySelector('#report-days-perf-chart');
    new HorizontalBarChart({
      container: perfHost,
      items: dayItems.map(d => ({ label: d.label, value: d.pnl })),
      valueKey: 'value',
      isCurrency: true
    });
  }

  renderInstrumentReport(host) {
    const symbolMap = {};
    this.trades.forEach(t => {
      const sym = t.symbol || 'OTHER';
      if (!symbolMap[sym]) {
        symbolMap[sym] = { label: sym, trades: 0, pnl: 0, wins: 0, grossWin: 0, grossLoss: 0, volume: 0 };
      }
      const item = symbolMap[sym];
      item.trades += 1;
      item.pnl += (t.pnl || 0);
      item.volume += (t.position_size || t.size || 1);
      if (t.pnl > 0) {
        item.wins += 1;
        item.grossWin += t.pnl;
      } else if (t.pnl < 0) {
        item.grossLoss += Math.abs(t.pnl);
      }
    });

    // Top 10 by trades count
    const topSymbols = Object.values(symbolMap).sort((a, b) => b.trades - a.trades).slice(0, 10);

    host.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px; max-width: 1200px; margin: 0 auto;">
        <!-- Two Side-by-Side Charts (PDF Page 4) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <!-- Chart 1: Top 10 Symbols Distribution -->
          <div class="chart-card">
            <div class="chart-card-header">
              <div class="chart-card-title">Top 10 Symbols Distribution</div>
            </div>
            <div id="report-sym-dist-chart" style="padding: 10px 0;"></div>
          </div>

          <!-- Chart 2: Top 10 Symbols Performance -->
          <div class="chart-card">
            <div class="chart-card-header">
              <div class="chart-card-title">Top 10 Symbols Performance</div>
            </div>
            <div id="report-sym-perf-chart" style="padding: 10px 0;"></div>
          </div>
        </div>

        <!-- Summary Table -->
        <div class="chart-card" style="padding: 0; overflow: hidden;">
          <div style="padding: 12px 16px; border-bottom: 1px solid var(--border-default); font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary);">
            Summary
          </div>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 11.5px;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-default); font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary); background: var(--fill-subtle);">
                <th style="padding: 8px 14px;">Instrument</th>
                <th style="padding: 8px 14px; text-align: right;">Net Profits</th>
                <th style="padding: 8px 14px; text-align: right;">Winning %</th>
                <th style="padding: 8px 14px; text-align: right;">Total Profits</th>
                <th style="padding: 8px 14px; text-align: right;">Total Loss</th>
                <th style="padding: 8px 14px; text-align: right;">Trades</th>
                <th style="padding: 8px 14px; text-align: right;">Volume</th>
              </tr>
            </thead>
            <tbody>
              ${topSymbols.map(s => {
                const winPct = s.trades > 0 ? (s.wins / s.trades) * 100 : 0;
                return `
                  <tr style="border-bottom: 1px solid var(--border-default);">
                    <td style="padding: 9px 14px; font-weight: 700; color: var(--text-primary);">${s.label}</td>
                    <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono);" class="${getMetricColorClass(s.pnl)}">${formatCurrency(s.pnl)}</td>
                    <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono);">${winPct.toFixed(2)}%</td>
                    <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono); color: var(--color-profit);">${formatCurrency(s.grossWin)}</td>
                    <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono); color: var(--color-loss);">-${formatCurrency(s.grossLoss)}</td>
                    <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono);">${s.trades}</td>
                    <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono);">${s.volume.toFixed(1)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Render distribution
    const distHost = host.querySelector('#report-sym-dist-chart');
    new HorizontalBarChart({
      container: distHost,
      items: topSymbols.map(s => ({ label: s.label, value: s.trades })),
      valueKey: 'value',
      isCurrency: false,
      barColor: '#5B55D9'
    });

    // Render performance
    const perfHost = host.querySelector('#report-sym-perf-chart');
    new HorizontalBarChart({
      container: perfHost,
      items: topSymbols.map(s => ({ label: s.label, value: s.pnl })),
      valueKey: 'value',
      isCurrency: true
    });
  }

  renderPeriodsReport(host, periodType) {
    const periodMap = {};
    this.trades.forEach(t => {
      const key = periodType === 'months' ? (t.date || '').substring(0, 7) : `Week ${Math.ceil(new Date(t.date || Date.now()).getDate() / 7)}`;
      if (!periodMap[key]) {
        periodMap[key] = { label: key, trades: 0, pnl: 0, wins: 0 };
      }
      periodMap[key].trades += 1;
      periodMap[key].pnl += (t.pnl || 0);
      if (t.pnl > 0) periodMap[key].wins += 1;
    });

    const items = Object.values(periodMap);

    host.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px; max-width: 1200px; margin: 0 auto;">
        <div class="chart-card">
          <div class="chart-card-header">
            <div class="chart-card-title">${periodType === 'months' ? 'Monthly' : 'Weekly'} Breakdown</div>
          </div>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 11.5px;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-default); font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary); background: var(--fill-subtle);">
                <th style="padding: 8px 14px;">Period</th>
                <th style="padding: 8px 14px; text-align: right;">Net P&L</th>
                <th style="padding: 8px 14px; text-align: right;">Win Rate</th>
                <th style="padding: 8px 14px; text-align: right;">Trades</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(p => `
                <tr style="border-bottom: 1px solid var(--border-default);">
                  <td style="padding: 9px 14px; font-weight: 600;">${p.label}</td>
                  <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono);" class="${getMetricColorClass(p.pnl)}">${formatCurrency(p.pnl)}</td>
                  <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono);">${p.trades > 0 ? ((p.wins / p.trades) * 100).toFixed(1) : 0}%</td>
                  <td style="padding: 9px 14px; text-align: right; font-family: var(--font-mono);">${p.trades}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderGenericDimensionReport(host, dim) {
    host.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px; max-width: 1200px; margin: 0 auto;">
        <div class="chart-card" style="padding: 32px; text-align: center; color: var(--text-tertiary); font-size: 12px;">
          ${dim.toUpperCase()} Report: All trade metrics currently aggregated within Overview and Instrument breakdowns.
        </div>
      </div>
    `;
  }
}
