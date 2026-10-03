/**
 * wealth/js/components/healthDiagnostic.js
 * Portfolio Health & Asset Growth Diagnostics Banner
 * Focuses purely on Net Worth Trajectory, Annual Yield, and Top Yield Drivers
 */
import { formatMYR, formatPercent } from '../core/math.js';

export function renderHealthDiagnostic(container, data) {
    if (!container) return;

    const totalNetWorth = data.portfolio?.total_net_worth_myr || 0;
    const estimatedApr = data.portfolio?.estimated_apr_myr || 0;
    const weightedRoi = data.portfolio?.weighted_roi || 0;
    const topContributors = data.insights?.top_apr_contributors || [];
    const deltaRm = data.growth?.delta_rm || 0;
    const growthRate = data.growth?.growth_rate || 0;
    const prevMonth = data.growth?.previous_month;

    if (!totalNetWorth && !topContributors.length) {
        container.innerHTML = `
            <div class="diagnostic-banner">
                <div class="diagnostic-left">
                    <div class="diagnostic-icon-badge">✦</div>
                    <div class="diagnostic-text">
                        <strong>Portfolio Initialization:</strong> Start by entering your cash, bank balances, crypto, or investments below to activate real-time asset analytics.
                    </div>
                </div>
            </div>
        `;
        return;
    }

    const chipsHtml = topContributors.map(c => `
        <div class="yield-chip" title="${c.platform} · ${c.product}: ${formatMYR(c.apr_amount_myr)} / yr">
            <span>${c.platform} (${c.product})</span>
            <span class="yield-chip-rate">${formatPercent(c.apr)}</span>
        </div>
    `).join("");

    let diagnosisMsg = "";
    if (deltaRm > 0 && prevMonth) {
        diagnosisMsg = `Portfolio expanded by <strong style="color:var(--color-profit);">+${formatMYR(deltaRm)}</strong> (+${formatPercent(growthRate)}) vs ${prevMonth}. Yield engines generate <strong>${formatMYR(estimatedApr)}</strong> / yr (${formatPercent(weightedRoi)} ROI).`;
    } else if (deltaRm < 0 && prevMonth) {
        diagnosisMsg = `Portfolio contracted by <strong style="color:var(--color-loss);">${formatMYR(deltaRm)}</strong> (${formatPercent(growthRate)}) vs ${prevMonth}. Passive yield cushions with <strong>${formatMYR(estimatedApr)}</strong> / yr.`;
    } else if (estimatedApr > 0) {
        diagnosisMsg = `Passive yield is pacing at <strong>${formatMYR(estimatedApr)}</strong> / year with an effective capital ROI of <strong>${formatPercent(weightedRoi)}</strong>.`;
    } else {
        diagnosisMsg = `Total assets tracked at <strong>${formatMYR(totalNetWorth)}</strong> across ${data.portfolio?.accounts_count || 0} holdings.`;
    }

    container.innerHTML = `
        <div class="diagnostic-banner">
            <div class="diagnostic-left">
                <div class="diagnostic-icon-badge">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                </div>
                <div class="diagnostic-text">
                    ${diagnosisMsg}
                </div>
            </div>
            <div class="top-yield-chips">
                <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Top Yield:</span>
                ${chipsHtml || '<span style="font-size:11px; color:var(--text-placeholder);">No interest-bearing assets</span>'}
            </div>
        </div>
    `;
}
