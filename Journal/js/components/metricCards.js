/**
 * metricCards.js
 * 核心 KPI 卡片组件（纯净 P&L 与 R，零 Balance 依赖）：
 * 统一度量切换：[$] 与 [R]
 */

import { formatCurrency, formatR, getMetricColorClass } from '../core/formatters.js';

export class MetricCards {
  constructor(options = {}) {
    this.container = options.container;
    this.metrics = options.metrics || {};
    this.unit = options.unit || '$'; // '$' | 'R'
    this.init();
  }

  update(metrics, unit = this.unit) {
    this.metrics = metrics;
    this.unit = unit;
    this.render();
  }

  init() {
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const m = this.metrics;
    const unit = this.unit;

    // 1. Net Performance
    let netValStr = unit === 'R' ? formatR(m.totalR) : formatCurrency(m.netPnl);
    let netClass = unit === 'R' ? getMetricColorClass(m.totalR) : getMetricColorClass(m.netPnl);

    // 2. Expectancy
    let expValStr = unit === 'R' ? formatR(m.expectancyR) : formatCurrency(m.expectancyAmount);
    let expClass = unit === 'R' ? getMetricColorClass(m.expectancyR) : getMetricColorClass(m.expectancyAmount);

    // 3. Average Trade
    let avgTradeStr = unit === 'R' ? formatR(m.averageR) : formatCurrency(m.averageTrade);
    let avgClass = unit === 'R' ? getMetricColorClass(m.averageR) : getMetricColorClass(m.averageTrade);

    // 4. Max Drawdown
    let maxDDStr = unit === 'R' ? formatR(-Math.abs(m.maxDrawdownR || 0), false) : formatCurrency(-Math.abs(m.maxDrawdownAmount || 0), false);

    // 5. Profit Factor
    const pfStr = m.profitFactor !== null && m.profitFactor !== undefined ? Number(m.profitFactor).toFixed(2) : 'N/A';

    const grid = document.createElement('div');
    grid.className = 'kpi-grid';

    grid.innerHTML = `
      <!-- Card 1: Net P&L / R -->
      <div class="kpi-card">
        <div class="kpi-label">Net Performance [${unit}]</div>
        <div class="kpi-value font-mono ${netClass}">${netValStr}</div>
        <div class="kpi-subtext">Gross Win: ${formatCurrency(m.grossProfit, false)}</div>
      </div>

      <!-- Card 2: Total R -->
      <div class="kpi-card">
        <div class="kpi-label">Total R</div>
        <div class="kpi-value font-mono ${getMetricColorClass(m.totalR)}">${formatR(m.totalR)}</div>
        <div class="kpi-subtext">${m.rCount || 0} trades with risk defined</div>
      </div>

      <!-- Card 3: Win Rate -->
      <div class="kpi-card">
        <div class="kpi-label">Win Rate</div>
        <div class="kpi-value font-mono">${(m.winRate || 0).toFixed(1)}%</div>
        <div class="kpi-subtext">${m.winningTrades || 0}W - ${m.losingTrades || 0}L - ${m.beTrades || 0}BE</div>
      </div>

      <!-- Card 4: Profit Factor -->
      <div class="kpi-card">
        <div class="kpi-label">Profit Factor</div>
        <div class="kpi-value font-mono">${pfStr}</div>
        <div class="kpi-subtext">Gross Loss: ${formatCurrency(m.grossLoss, false)}</div>
      </div>

      <!-- Card 5: Expectancy -->
      <div class="kpi-card">
        <div class="kpi-label">Expectancy [${unit}]</div>
        <div class="kpi-value font-mono ${expClass}">${expValStr}</div>
        <div class="kpi-subtext">Avg edge per trade</div>
      </div>

      <!-- Card 6: Total Trades -->
      <div class="kpi-card">
        <div class="kpi-label">Trades Count</div>
        <div class="kpi-value font-mono">${m.totalTrades || 0}</div>
        <div class="kpi-subtext">Best Streak: ${m.winningStreak || 0}W / ${m.losingStreak || 0}L</div>
      </div>

      <!-- Card 7: Average Trade -->
      <div class="kpi-card">
        <div class="kpi-label">Average Trade [${unit}]</div>
        <div class="kpi-value font-mono ${avgClass}">${avgTradeStr}</div>
        <div class="kpi-subtext">Win: ${formatCurrency(m.averageWin, false)} | Loss: ${formatCurrency(m.averageLoss, false)}</div>
      </div>

      <!-- Card 8: Max Drawdown -->
      <div class="kpi-card">
        <div class="kpi-label">Max Drawdown [${unit}]</div>
        <div class="kpi-value font-mono text-loss">${maxDDStr}</div>
        <div class="kpi-subtext">Peak to trough</div>
      </div>
    `;

    this.container.appendChild(grid);
  }
}

/**
 * PDF-Standard Dashboard 5 KPI Cards (with Circular gauges, Semi-circle gauge, Win/Loss bar)
 */
import { renderCircularGauge, renderSemiGauge, renderWinLossBar } from './charts.js';

export class DashboardKpiCards {
  constructor(options = {}) {
    this.container = options.container;
    this.metrics = options.metrics || {};
    this.unit = options.unit || '$';
    this.init();
  }

  update(metrics, unit = this.unit) {
    this.metrics = metrics;
    this.unit = unit;
    this.render();
  }

  init() {
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const m = this.metrics;
    const unit = this.unit;

    // 1. Net P&L
    const netVal = m.netPnl !== undefined ? m.netPnl : 0;
    const netValStr = unit === 'R' ? formatR(m.totalR) : formatCurrency(netVal);
    const netColorClass = getMetricColorClass(netVal);
    const isNetPositive = netVal >= 0;

    // 2. Trade Win %
    const winRate = m.winRate !== undefined ? Number(m.winRate) : 0;
    const winRateStr = `${winRate.toFixed(2)}%`;
    const winGaugeSvg = renderCircularGauge(winRate, '#5B55D9', 52);

    // 3. Profit Factor
    const pf = m.profitFactor !== null && m.profitFactor !== undefined ? Number(m.profitFactor) : 0;
    const pfStr = pf > 0 ? pf.toFixed(2) : '0.00';
    const pfGaugePct = Math.min(100, (pf / 3.0) * 100);
    const pfGaugeSvg = renderCircularGauge(pfGaugePct, '#4FC3A1', 52);

    // 4. Day Win %
    const dayWinRate = m.dayWinRate !== undefined ? Number(m.dayWinRate) : (m.dailyDistribution ? 
      (() => {
        const days = Object.values(m.dailyDistribution);
        if (days.length === 0) return 0;
        const winDays = days.filter(d => (unit === 'R' ? d.r : d.pnl) > 0).length;
        return (winDays / days.length) * 100;
      })() : 0);
    const dayWinRateStr = `${dayWinRate.toFixed(2)}%`;
    const daySemiGaugeSvg = renderSemiGauge(dayWinRate, '#4FC3A1', 60, 32);

    // 5. Avg win / loss trade
    const avgWin = m.averageWin || 0;
    const avgLoss = Math.abs(m.averageLoss || 0);
    const ratio = avgLoss > 0 ? (avgWin / avgLoss) : (avgWin > 0 ? avgWin : 0);
    const ratioStr = ratio > 0 ? ratio.toFixed(2) : '0.00';
    const winLossBarHtml = renderWinLossBar(avgWin, avgLoss, ratio);

    const html = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; width: 100%;">
        <!-- Card 1: Net P&L -->
        <div class="kpi-card" style="padding: 12px 16px; display: flex; flex-direction: column; justify-content: space-between; min-height: 96px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px;">Net P&L [${unit}]</span>
            <span style="font-size: 12px; color: ${isNetPositive ? 'var(--profit-color)' : 'var(--loss-color)'};">
              ${isNetPositive ? '▲' : '▼'}
            </span>
          </div>
          <div style="font-size: 22px; font-weight: 700; font-family: var(--font-mono); margin: 4px 0;" class="${netColorClass}">
            ${netValStr}
          </div>
          <div style="font-size: 10.5px; color: var(--text-tertiary);">
            ${m.totalTrades || 0} Total Trades (${m.winningTrades || 0}W / ${m.losingTrades || 0}L)
          </div>
        </div>

        <!-- Card 2: Trade Win % -->
        <div class="kpi-card" style="padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; min-height: 96px;">
          <div>
            <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px;">Trade Win %</div>
            <div style="font-size: 22px; font-weight: 700; font-family: var(--font-mono); color: var(--text-main);">${winRateStr}</div>
            <div style="font-size: 10px; color: var(--text-tertiary); margin-top: 2px;">Win / Closed trades</div>
          </div>
          <div style="display: flex; align-items: center; justify-content: center;">
            ${winGaugeSvg}
          </div>
        </div>

        <!-- Card 3: Profit Factor -->
        <div class="kpi-card" style="padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; min-height: 96px;">
          <div>
            <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px;">Profit Factor</div>
            <div style="font-size: 22px; font-weight: 700; font-family: var(--font-mono); color: var(--text-main);">${pfStr}</div>
            <div style="font-size: 10px; color: var(--text-tertiary); margin-top: 2px;">Gross Win / Gross Loss</div>
          </div>
          <div style="display: flex; align-items: center; justify-content: center;">
            ${pfGaugeSvg}
          </div>
        </div>

        <!-- Card 4: Day Win % -->
        <div class="kpi-card" style="padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; min-height: 96px;">
          <div>
            <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 4px;">Day Win %</div>
            <div style="font-size: 22px; font-weight: 700; font-family: var(--font-mono); color: var(--text-main);">${dayWinRateStr}</div>
            <div style="font-size: 10px; color: var(--text-tertiary); margin-top: 2px;">Profitable calendar days</div>
          </div>
          <div style="display: flex; align-items: center; justify-content: center; padding-top: 4px;">
            ${daySemiGaugeSvg}
          </div>
        </div>

        <!-- Card 5: Avg win/loss trade -->
        <div class="kpi-card" style="padding: 12px 16px; display: flex; flex-direction: column; justify-content: space-between; min-height: 96px;">
          <div>
            <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px;">Avg win/loss trade</div>
            <div style="font-size: 22px; font-weight: 700; font-family: var(--font-mono); color: var(--text-main);">${ratioStr}</div>
          </div>
          ${winLossBarHtml}
        </div>
      </div>
    `;

    this.container.innerHTML = html;
  }
}

