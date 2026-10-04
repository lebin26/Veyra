/**
 * wealth/js/components/kpiCards.js
 * Financial KPI metric cards renderer
 * 100% Asset & Net Worth Tracking (No cashflow/bookkeeping dependencies)
 */
import { formatMYR, formatPercent, formatNumber } from '../core/math.js';

export function renderKPICards(container, data, onEditRate) {
    if (!container) return;

    const fxState = window.VEYRA_FX || {};
    const effectiveRate = (typeof data.usd_rate === 'number' && data.usd_rate > 0)
        ? data.usd_rate
        : (typeof fxState.USDMYR === 'number' ? fxState.USDMYR : null);
    const rateDate = fxState.date || null;
    const isFallback = Boolean(fxState.isFallback);
    const formattedRate = (effectiveRate !== null && Number.isFinite(effectiveRate) && effectiveRate > 0)
        ? effectiveRate.toFixed(4)
        : "—";
    const rateSubtext = formattedRate !== "—"
        ? `1 USD = ${formattedRate} MYR${isFallback ? ' · Cached' : ''}`
        : "Rate currently unavailable";

    const {
        portfolio = {},
        growth = {},
        insights = {}
    } = data || {};

    const netWorth = portfolio.total_net_worth_myr || 0;
    const estimatedApr = portfolio.estimated_apr_myr || 0;
    const weightedRoi = portfolio.weighted_roi || 0;
    const accountsCount = portfolio.accounts_count || 0;

    const deltaRm = growth.delta_rm || 0;
    const growthRate = growth.growth_rate || 0;
    const hasPrevious = growth.previous_month !== null && growth.previous_month !== undefined;
    const prevNetWorth = growth.previous_net_worth || 0;

    const topContributor = (insights.top_apr_contributors || [])[0] || null;

    // Growth trend class
    let trendClass = "trend-neutral";
    let trendSign = "";
    if (deltaRm > 0) {
        trendClass = "trend-positive";
        trendSign = "+";
    } else if (deltaRm < 0) {
        trendClass = "trend-negative";
    }

    container.innerHTML = `
        <div class="kpi-grid-primary">
            <!-- 1. Total Net Worth (Hero) -->
            <div class="kpi-card kpi-card-hero">
                <div class="kpi-label-group">
                    <span>Total Net Worth</span>
                    <span class="tabular-nums">${accountsCount} Assets</span>
                </div>
                <div class="kpi-val-hero tabular-nums">${formatMYR(netWorth)}</div>
                <div class="kpi-subtext">Multi-currency converted to MYR</div>
            </div>

            <!-- 2. Estimated APR Return -->
            <div class="kpi-card">
                <div class="kpi-label-group">
                    <span>Est. Annual Return</span>
                    <span>12M Projected</span>
                </div>
                <div class="kpi-val-regular tabular-nums" style="color: var(--color-profit);">${formatMYR(estimatedApr)}</div>
                <div class="kpi-subtext">Annual interest & staking yield</div>
            </div>

            <!-- 3. Weighted ROI -->
            <div class="kpi-card">
                <div class="kpi-label-group">
                    <span>Weighted Yield (ROI)</span>
                    <span>Portfolio</span>
                </div>
                <div class="kpi-val-regular tabular-nums">${formatPercent(weightedRoi)}</div>
                <div class="kpi-subtext">Overall portfolio weighted rate</div>
            </div>

            <!-- 4. Active USD/MYR Rate -->
            <div class="kpi-card" id="kpi-card-rate" title="USD/MYR FX Benchmark · Frankfurter">
                <div class="kpi-label-group">
                    <span>USD / MYR FX Rate</span>
                    <span style="font-size: 10px; color: var(--text-secondary);">${rateDate ? `Date: ${rateDate}` : 'Frankfurter'}</span>
                </div>
                <div class="kpi-val-regular tabular-nums">${formattedRate}</div>
                <div class="kpi-subtext">${rateSubtext}</div>
            </div>
        </div>

        <div class="kpi-grid-secondary">
            <!-- 5. Monthly Asset Absolute Growth -->
            <div class="kpi-card">
                <div class="kpi-label-group">
                    <span>Asset Growth (Δ RM)</span>
                    <span>${hasPrevious ? `vs ${growth.previous_month}` : 'Base'}</span>
                </div>
                <div class="kpi-val-regular tabular-nums ${trendClass}">
                    ${hasPrevious ? `${trendSign}${formatMYR(deltaRm)}` : '—'}
                </div>
                <div class="kpi-subtext">
                    ${hasPrevious
                        ? `<span class="trend-badge ${trendClass}">${trendSign}${formatPercent(growthRate)} MoM</span>`
                        : 'First recorded month'}
                </div>
            </div>

            <!-- 6. MoM Growth Rate -->
            <div class="kpi-card">
                <div class="kpi-label-group">
                    <span>Growth Rate (%)</span>
                    <span>MoM Change</span>
                </div>
                <div class="kpi-val-regular tabular-nums ${trendClass}">
                    ${hasPrevious ? `${trendSign}${formatPercent(growthRate)}` : '—'}
                </div>
                <div class="kpi-subtext">${hasPrevious ? 'Month-over-month growth' : 'Baseline snapshot'}</div>
            </div>

            <!-- 7. Previous Month Base -->
            <div class="kpi-card">
                <div class="kpi-label-group">
                    <span>Prior Base</span>
                    <span>${hasPrevious ? growth.previous_month : 'None'}</span>
                </div>
                <div class="kpi-val-regular tabular-nums" style="color: var(--text-secondary);">
                    ${hasPrevious ? formatMYR(prevNetWorth) : '—'}
                </div>
                <div class="kpi-subtext">${hasPrevious ? 'Archived benchmark net worth' : 'No previous archive'}</div>
            </div>

            <!-- 8. Top APR Contributor -->
            <div class="kpi-card">
                <div class="kpi-label-group">
                    <span>Top Yield Driver</span>
                    <span style="color: var(--color-profit);">${topContributor ? formatPercent(topContributor.apr) : '—'}</span>
                </div>
                <div class="kpi-val-regular tabular-nums" style="font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${topContributor ? `${topContributor.platform}` : '—'}
                </div>
                <div class="kpi-subtext">${topContributor ? `${topContributor.product} (${formatMYR(topContributor.apr_amount_myr)}/yr)` : 'No active yield product'}</div>
            </div>
        </div>
    `;

    // Rate card is an automated live reference indicator (manual editing disallowed)
}
