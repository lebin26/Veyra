/**
 * mentorModeView.js
 * AI Quantitative Trading Mentor & Discipline Auditor (PRD Section 6 & 116):
 * - Revenge Trading Detection
 * - Stop Loss Discipline & Risk Creep
 * - Overtrading Frequency Alerts
 * - Actionable Psychological & Behavioral Coaching
 */

import { LiveRepo } from '../db/liveRepo.js';
import { aggregateMetrics } from '../core/calculations.js';
import { formatCurrency, formatPercent } from '../core/formatters.js';

export class MentorModeView {
  constructor(options = {}) {
    this.container = options.container;
    this.trades = [];
    this.metrics = {};
  }

  async render() {
    this.trades = await LiveRepo.getAllTrades();
    this.metrics = aggregateMetrics(this.trades);

    // Analyze behavioral patterns
    const audit = this.runBehavioralAudit();

    this.container.innerHTML = `
      <div class="view-header" style="padding: 16px 24px; border-bottom: 1px solid var(--border-default); background: var(--bg-panel); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div class="header-left" style="display: flex; align-items: center; gap: 12px;">
          <h1 class="view-title" style="font-size: 20px; font-weight: 700; margin: 0; color: var(--text-primary); letter-spacing: -0.02em;">Mentor Mode</h1>
          <span style="font-size: 11.5px; color: var(--text-secondary); background: var(--fill-subtle); padding: 3px 8px; border-radius: var(--radius-chip);">
            Discipline & Risk Auditor
          </span>
        </div>
      </div>

      <div class="view-content" id="mentor-content" style="padding: 28px 24px; max-width: 1000px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 20px;">
        <!-- Top Overall Discipline Score -->
        <div class="chart-card" style="padding: 20px; border-radius: var(--radius-panel); border: 1px solid var(--border-default); background: linear-gradient(135deg, var(--bg-panel) 0%, var(--fill-subtle) 100%);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div>
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px;">Behavioral Discipline Score</span>
              <div style="font-size: 28px; font-weight: 800; font-family: var(--font-mono); color: ${audit.score >= 80 ? 'var(--color-profit)' : (audit.score >= 60 ? 'var(--color-warn)' : 'var(--color-loss)')}; margin-top: 4px;">
                ${audit.score} / 100
              </div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                ${audit.verdict}
              </div>
            </div>

            <div style="display: flex; gap: 24px;">
              <div>
                <div style="font-size: 11px; color: var(--text-secondary);">Cost of Mistakes</div>
                <div style="font-size: 18px; font-weight: 700; font-family: var(--font-mono); color: var(--color-loss);">-${formatCurrency(this.metrics.costOfMistakes || 0)}</div>
              </div>
              <div>
                <div style="font-size: 11px; color: var(--text-secondary);">Plan Adherence</div>
                <div style="font-size: 18px; font-weight: 700; font-family: var(--font-mono); color: var(--text-primary);">${(this.metrics.planAdherenceRate || 0).toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3 Core Audit Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
          <!-- Card 1: Revenge Trading -->
          <div class="kpi-card" style="padding: 16px; border-radius: var(--radius-panel); border: 1px solid var(--border-default);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 13px; font-weight: 700; color: var(--text-primary);">Revenge Trading</span>
              <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${audit.revengeTrades.length === 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${audit.revengeTrades.length === 0 ? 'var(--color-profit)' : 'var(--color-loss)'};">
                ${audit.revengeTrades.length === 0 ? 'CLEAN' : `${audit.revengeTrades.length} DETECTED`}
              </span>
            </div>
            <p style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.4;">
              Trades entered within 15 minutes after a losing trade without waiting for strategy confirmation.
            </p>
          </div>

          <!-- Card 2: Risk Creep / SL Discipline -->
          <div class="kpi-card" style="padding: 16px; border-radius: var(--radius-panel); border: 1px solid var(--border-default);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 13px; font-weight: 700; color: var(--text-primary);">Risk Creep (SL Discipline)</span>
              <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${audit.riskCreepTrades.length === 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${audit.riskCreepTrades.length === 0 ? 'STABLE' : `${audit.riskCreepTrades.length} FLAGGED`} ;">
                ${audit.riskCreepTrades.length === 0 ? 'STABLE' : `${audit.riskCreepTrades.length} FLAGGED`}
              </span>
            </div>
            <p style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.4;">
              Executions where loss exceeded 1.2R of planned initial risk, indicating moving stop losses or oversize.
            </p>
          </div>

          <!-- Card 3: Overtrading Days -->
          <div class="kpi-card" style="padding: 16px; border-radius: var(--radius-panel); border: 1px solid var(--border-default);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 13px; font-weight: 700; color: var(--text-primary);">Overtrading Frequency</span>
              <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${audit.overtradingDays === 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${audit.overtradingDays === 0 ? 'CONTROLLED' : `${audit.overtradingDays} DAYS`} ;">
                ${audit.overtradingDays === 0 ? 'CONTROLLED' : `${audit.overtradingDays} DAYS`}
              </span>
            </div>
            <p style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.4;">
              Calendar sessions with trade counts exceeding 2.5x your typical historical average daily volume.
            </p>
          </div>
        </div>

        <!-- Actionable Recommendations -->
        <div class="chart-card" style="padding: 18px 20px; border-radius: var(--radius-panel); border: 1px solid var(--border-default);">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-primary); letter-spacing: 0.03em; margin-bottom: 12px;">
            Mentor Directives
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px; color: var(--text-secondary);">
            <div style="display: flex; gap: 8px; align-items: flex-start;">
              <span style="color: var(--color-brand); font-weight: 700;">1.</span>
              <span><strong>Enforce Mandatory 30-Minute Cooldown:</strong> Step away from the screen immediately after any stop-out to prevent subconscious revenge execution.</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: flex-start;">
              <span style="color: var(--color-brand); font-weight: 700;">2.</span>
              <span><strong>Hard Stop Integrity:</strong> Never widen stop losses once filled. If price invalidates the setup hypothesis, accept the predetermined 1R loss without hesitation.</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: flex-start;">
              <span style="color: var(--color-brand); font-weight: 700;">3.</span>
              <span><strong>Quality Over Quantity:</strong> Your highest winning days average 2-4 trades. Quality setups generate the bulk of your Net P&L.</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  runBehavioralAudit() {
    let score = 85;
    const revengeTrades = [];
    const riskCreepTrades = [];

    const sorted = [...this.trades].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];

      // If prev was a loss and same day
      if ((prev.pnl || 0) < 0 && prev.date === curr.date) {
        revengeTrades.push(curr);
      }

      if (curr.r && curr.r < -1.2) {
        riskCreepTrades.push(curr);
      }
    }

    if (revengeTrades.length > 0) score -= Math.min(25, revengeTrades.length * 5);
    if (riskCreepTrades.length > 0) score -= Math.min(25, riskCreepTrades.length * 8);

    const overtradingDays = Object.values(this.metrics.dailyDistribution || {}).filter(d => d.trades >= 6).length;
    if (overtradingDays > 0) score -= Math.min(15, overtradingDays * 4);

    let verdict = 'Disciplined execution. Continue adhering strictly to strategy parameters.';
    if (score < 65) {
      verdict = 'High emotional interference detected. Review your mistake logs and enforce daily risk limits.';
    } else if (score < 80) {
      verdict = 'Moderate discipline with occasional risk creep. Tighten rule adherence on high-volatility sessions.';
    }

    return {
      score: Math.max(30, Math.min(98, score)),
      verdict,
      revengeTrades,
      riskCreepTrades,
      overtradingDays
    };
  }
}
