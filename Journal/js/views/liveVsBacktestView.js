/**
 * liveVsBacktestView.js
 * 实盘 vs 回测对照分析视图（VEYRA 核心对比洞察）：
 * 直观对比：
 * - 理论回测表现（Backtest）
 * - 真实实盘执行（Live Trading）
 * 计算两者在 Win Rate, Avg R, Profit Factor, Expectancy, Max Drawdown 的执行偏差 (Execution Gap)！
 */

import { LiveRepo } from '../db/liveRepo.js';
import { BacktestRepo } from '../db/backtestRepo.js';
import { aggregateMetrics } from '../core/calculations.js';
import { formatCurrency, formatR, getMetricColorClass } from '../core/formatters.js';

export class LiveVsBacktestView {
  constructor(options = {}) {
    this.container = options.container;
    this.liveTrades = [];
    this.backtestTrades = [];
    this.account = null;
  }

  async render() {
    this.account = await LiveRepo.getAccount();
    this.liveTrades = await LiveRepo.getAllTrades();
    this.backtestTrades = await BacktestRepo.getAllBacktestTrades();

    const liveM = aggregateMetrics(this.liveTrades, this.account ? this.account.starting_balance : 10000);
    const btM = aggregateMetrics(this.backtestTrades, 10000);

    // 计算关键偏差 (Execution Gap = Live - Backtest)
    const wrGap = liveM.winRate - btM.winRate;
    const avgRGap = (liveM.averageR || 0) - (btM.averageR || 0);
    const pfGap = (Number(liveM.profitFactor) || 0) - (Number(btM.profitFactor) || 0);

    this.container.innerHTML = `
      <div class="view-header">
        <div class="header-left">
          <div class="view-title">Live vs Backtest Comparative Analysis</div>
        </div>
      </div>

      <div class="view-content" id="live-vs-bt-content">
        <!-- Reality Check Notice -->
        <div style="background: var(--surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 14px 18px; margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">
            Execution Gap Analysis
          </div>
          <p style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.5;">
            Comparing theoretical strategy performance in Backtest against real-money Live execution. 
            A negative gap indicates psychological friction, slippage, or rule deviations in live execution.
          </p>
        </div>

        <!-- Comparative KPI Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 16px;">
          <!-- Win Rate Comparison -->
          <div class="kpi-card">
            <div class="kpi-label">Win Rate Comparison</div>
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px;">
              <div>
                <span style="font-size: 10px; color: var(--text-tertiary);">LIVE: </span>
                <span class="font-mono" style="font-size: 16px; font-weight: 700;">${liveM.winRate.toFixed(1)}%</span>
              </div>
              <div>
                <span style="font-size: 10px; color: var(--text-tertiary);">BACKTEST: </span>
                <span class="font-mono" style="font-size: 16px; font-weight: 700;">${btM.winRate.toFixed(1)}%</span>
              </div>
            </div>
            <div class="kpi-subtext" style="color: ${wrGap >= 0 ? 'var(--profit-color)' : 'var(--loss-color)'}; font-weight: 600;">
              Gap: ${wrGap >= 0 ? '+' : ''}${wrGap.toFixed(1)}%
            </div>
          </div>

          <!-- Average R Comparison -->
          <div class="kpi-card">
            <div class="kpi-label">Average R per Trade</div>
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px;">
              <div>
                <span style="font-size: 10px; color: var(--text-tertiary);">LIVE: </span>
                <span class="font-mono ${getMetricColorClass(liveM.averageR)}" style="font-size: 16px; font-weight: 700;">${formatR(liveM.averageR)}</span>
              </div>
              <div>
                <span style="font-size: 10px; color: var(--text-tertiary);">BACKTEST: </span>
                <span class="font-mono ${getMetricColorClass(btM.averageR)}" style="font-size: 16px; font-weight: 700;">${formatR(btM.averageR)}</span>
              </div>
            </div>
            <div class="kpi-subtext" style="color: ${avgRGap >= 0 ? 'var(--profit-color)' : 'var(--loss-color)'}; font-weight: 600;">
              Gap: ${avgRGap >= 0 ? '+' : ''}${avgRGap.toFixed(2)}R
            </div>
          </div>

          <!-- Profit Factor Comparison -->
          <div class="kpi-card">
            <div class="kpi-label">Profit Factor</div>
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 4px;">
              <div>
                <span style="font-size: 10px; color: var(--text-tertiary);">LIVE: </span>
                <span class="font-mono" style="font-size: 16px; font-weight: 700;">${liveM.profitFactor ? liveM.profitFactor.toFixed(2) : 'N/A'}</span>
              </div>
              <div>
                <span style="font-size: 10px; color: var(--text-tertiary);">BACKTEST: </span>
                <span class="font-mono" style="font-size: 16px; font-weight: 700;">${btM.profitFactor ? btM.profitFactor.toFixed(2) : 'N/A'}</span>
              </div>
            </div>
            <div class="kpi-subtext" style="color: ${pfGap >= 0 ? 'var(--profit-color)' : 'var(--loss-color)'}; font-weight: 600;">
              Gap: ${pfGap >= 0 ? '+' : ''}${pfGap.toFixed(2)}
            </div>
          </div>
        </div>

        <!-- Full Detailed Comparison Table -->
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Statistical Metric</th>
                <th class="text-right">Live Trading (Real Execution)</th>
                <th class="text-right">Backtesting (Historical Model)</th>
                <th class="text-right">Variance / Execution Gap</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 600;">Sample Size (Trades)</td>
                <td class="text-right font-mono">${liveM.totalTrades}</td>
                <td class="text-right font-mono">${btM.totalTrades}</td>
                <td class="text-right font-mono">${liveM.totalTrades - btM.totalTrades}</td>
              </tr>
              <tr>
                <td style="font-weight: 600;">Win Rate</td>
                <td class="text-right font-mono">${liveM.winRate.toFixed(1)}%</td>
                <td class="text-right font-mono">${btM.winRate.toFixed(1)}%</td>
                <td class="text-right font-mono ${wrGap >= 0 ? 'text-profit' : 'text-loss'}">${wrGap >= 0 ? '+' : ''}${wrGap.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style="font-weight: 600;">Total Realized R</td>
                <td class="text-right font-mono ${getMetricColorClass(liveM.totalR)}">${formatR(liveM.totalR)}</td>
                <td class="text-right font-mono ${getMetricColorClass(btM.totalR)}">${formatR(btM.totalR)}</td>
                <td class="text-right font-mono">${formatR(liveM.totalR - btM.totalR)}</td>
              </tr>
              <tr>
                <td style="font-weight: 600;">Average R per Trade</td>
                <td class="text-right font-mono ${getMetricColorClass(liveM.averageR)}">${formatR(liveM.averageR)}</td>
                <td class="text-right font-mono ${getMetricColorClass(btM.averageR)}">${formatR(btM.averageR)}</td>
                <td class="text-right font-mono ${avgRGap >= 0 ? 'text-profit' : 'text-loss'}">${avgRGap >= 0 ? '+' : ''}${avgRGap.toFixed(2)}R</td>
              </tr>
              <tr>
                <td style="font-weight: 600;">Profit Factor</td>
                <td class="text-right font-mono">${liveM.profitFactor ? liveM.profitFactor.toFixed(2) : 'N/A'}</td>
                <td class="text-right font-mono">${btM.profitFactor ? btM.profitFactor.toFixed(2) : 'N/A'}</td>
                <td class="text-right font-mono ${pfGap >= 0 ? 'text-profit' : 'text-loss'}">${pfGap >= 0 ? '+' : ''}${pfGap.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="font-weight: 600;">Expectancy $ per Trade</td>
                <td class="text-right font-mono ${getMetricColorClass(liveM.expectancyAmount)}">${formatCurrency(liveM.expectancyAmount)}</td>
                <td class="text-right font-mono ${getMetricColorClass(btM.expectancyAmount)}">${formatCurrency(btM.expectancyAmount)}</td>
                <td class="text-right font-mono">${formatCurrency(liveM.expectancyAmount - btM.expectancyAmount)}</td>
              </tr>
              <tr>
                <td style="font-weight: 600;">Max Drawdown (R)</td>
                <td class="text-right font-mono text-loss">-${formatR(liveM.maxDrawdownR, false)}</td>
                <td class="text-right font-mono text-loss">-${formatR(btM.maxDrawdownR, false)}</td>
                <td class="text-right font-mono">${formatR(liveM.maxDrawdownR - btM.maxDrawdownR, false)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}
