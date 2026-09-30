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
