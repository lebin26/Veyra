/**
 * wealth/js/components/chartEngine.js
 * Native Financial SVG Visualization & Analytics Engine
 * Supports Multi-Dimensional and Multi-Perspective Quantitative Analysis:
 *  - Dimensions: By Platform (Default), By Product, By Category
 *  - Analysis Types:
 *      1. Asset Allocation (Donut & Bar)
 *      2. Return Breakdown (Donut & Bar)
 *      3. APR Return Rate Comparison (Ranked Horizontal Bars)
 *      4. Net Worth Growth Trajectory (Trend Line)
 * Zero external libraries, high performance, fully theme-calibrated.
 */
import { formatMYR, formatPercent } from '../core/math.js';

const PALETTE = [
    "#2F5BFF", // Brand Blue
    "#10B981", // Emerald
    "#F59E0B", // Amber
    "#6366F1", // Indigo
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#8B5CF6", // Violet
    "#14B8A6", // Teal
    "#F97316", // Orange
    "#64748B", // Slate
    "#3B82F6", // Sky
    "#84CC16"  // Lime
];

export function renderChartEngine(container, analyticsData = {}) {
    if (!container) return;

    // Default configuration: By Platform, Asset Allocation, Donut Chart
    let activeMetric = "assets";      // 'assets' | 'return' | 'apr' | 'trend'
    let activeDimension = "platform";  // 'platform' (default) | 'product' | 'category'
    let activeFormat = "pie";          // 'pie' | 'bar'

    const accounts = analyticsData.accounts || [];
    const historySnapshots = analyticsData.history_snapshots || [];
    const portfolio = analyticsData.portfolio || {};

    // ──────────────────────────────────────────
    // 1. Data Aggregation by Dimension
    // ──────────────────────────────────────────
    function aggregateData(dimension) {
        const map = {};

        accounts.forEach(acc => {
            let rawKey = acc[dimension];
            if (!rawKey || !rawKey.trim()) {
                rawKey = dimension === 'product' ? 'Standard' : (dimension === 'category' ? 'bank' : 'Other');
            }
            rawKey = rawKey.trim();

            // When grouping by product, prefix with platform for clear disambiguation
            const displayLabel = dimension === 'product' && acc.platform ? `${acc.platform} · ${rawKey}` : rawKey;
            const groupKey = dimension === 'product' ? `${acc.platform}:::${rawKey}` : rawKey;

            if (!map[groupKey]) {
                map[groupKey] = {
                    key: groupKey,
                    label: displayLabel,
                    category: acc.category || 'bank',
                    amount_myr: 0,
                    apr_amount_myr: 0,
                    count: 0
                };
            }

            map[groupKey].amount_myr += Number(acc.amount_myr) || 0;
            map[groupKey].apr_amount_myr += Number(acc.apr_amount_myr) || 0;
            map[groupKey].count += 1;
        });

        const items = Object.values(map);
        const totalAssets = items.reduce((sum, item) => sum + item.amount_myr, 0);
        const totalReturn = items.reduce((sum, item) => sum + item.apr_amount_myr, 0);

        return items.map(item => {
            const weightedApr = item.amount_myr > 0 ? (item.apr_amount_myr / item.amount_myr) * 100 : 0;
            const assetPercent = totalAssets > 0 ? (item.amount_myr / totalAssets) * 100 : 0;
            const returnPercent = totalReturn > 0 ? (item.apr_amount_myr / totalReturn) * 100 : 0;

            return {
                label: item.label,
                category: item.category,
                amount_myr: item.amount_myr,
                apr_amount_myr: item.apr_amount_myr,
                apr_rate: Math.round(weightedApr * 100) / 100,
                asset_percent: Math.round(assetPercent * 10) / 10,
                return_percent: Math.round(returnPercent * 10) / 10,
                count: item.count
            };
        });
    }

    // ──────────────────────────────────────────
    // 2. Shell Layout & Controls
    // ──────────────────────────────────────────
    function renderShell() {
        const isTrend = activeMetric === "trend";
        const isApr = activeMetric === "apr";
        const canToggleFormat = !isTrend && !isApr;

        const dimTitle = activeDimension === "platform" ? "Platform" : (activeDimension === "product" ? "Product" : "Category");
        let tagText = "Asset Allocation";
        if (activeMetric === "return") tagText = "Return Distribution";
        else if (activeMetric === "apr") tagText = "APR Comparison";
        else if (activeMetric === "trend") tagText = "Growth Trajectory";

        container.innerHTML = `
            <div class="charts-section">
                <!-- Header & Interactive Controls -->
                <div class="charts-header">
                    <div class="section-title-group">
                        <h2 class="section-title">Visual Analytics</h2>
                        <span class="section-count-tag" id="chart-tag-info">${isTrend ? tagText : `${dimTitle} · ${tagText}`}</span>
                    </div>

                    <div class="chart-controls-group">
                        <!-- 1. Dimension Switcher (Platform default, Product, Category) -->
                        <div id="chart-dim-wrap" class="chart-dim-filters" style="${isTrend ? 'display:none;' : 'display:flex;'}">
                            <span class="chart-dim-label">Group By:</span>
                            <select id="chart-dim-select" class="chart-dim-select" title="Choose grouping dimension">
                                <option value="platform" ${activeDimension === 'platform' ? 'selected' : ''}>By Platform (默认)</option>
                                <option value="product" ${activeDimension === 'product' ? 'selected' : ''}>By Product</option>
                                <option value="category" ${activeDimension === 'category' ? 'selected' : ''}>By Category</option>
                            </select>
                        </div>

                        <!-- 2. Primary Analysis Metric Switcher -->
                        <div class="chart-metric-segmented" role="tablist">
                            <button type="button" class="chart-metric-btn ${activeMetric === 'assets' ? 'active' : ''}" data-metric="assets" title="Asset Allocation Breakdown">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                                Assets
                            </button>
                            <button type="button" class="chart-metric-btn ${activeMetric === 'return' ? 'active' : ''}" data-metric="return" title="Expected Annual Return Breakdown">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path><line x1="12" y1="6" x2="12" y2="8"></line><line x1="12" y1="16" x2="12" y2="18"></line></svg>
                                Return
                            </button>
                            <button type="button" class="chart-metric-btn ${activeMetric === 'apr' ? 'active' : ''}" data-metric="apr" title="APR Return Rate Comparison">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                                APR Rate
                            </button>
                            <button type="button" class="chart-metric-btn ${activeMetric === 'trend' ? 'active' : ''}" data-metric="trend" title="Net Worth Growth Curve">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                                Trend
                            </button>
                        </div>

                        <!-- 3. Format Toggle (Donut vs Bar) for Assets and Return -->
                        <div id="chart-format-wrap" class="chart-format-toggle" style="${canToggleFormat ? 'display:flex;' : 'display:none;'}">
                            <button type="button" class="format-btn ${activeFormat === 'pie' ? 'active' : ''}" data-format="pie" title="Donut Pie Chart">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
                                Donut
                            </button>
                            <button type="button" class="format-btn ${activeFormat === 'bar' ? 'active' : ''}" data-format="bar" title="Bar Chart Comparison">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                                Bar
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Canvas Body Area -->
                <div class="chart-body-container" id="chart-body">
                    <!-- SVG charts injected here -->
                </div>

                <!-- Floating Micro-Tooltip -->
                <div id="chart-tooltip" class="chart-tooltip"></div>
            </div>
        `;

        bindEvents();
        renderActiveChart();
    }

    function bindEvents() {
        // Dimension Select
        const dimSelect = container.querySelector("#chart-dim-select");
        if (dimSelect) {
            dimSelect.addEventListener("change", (e) => {
                activeDimension = e.target.value;
                updateHeaderTag();
                renderActiveChart();
            });
        }

        // Metric Buttons
        container.querySelectorAll(".chart-metric-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                activeMetric = btn.dataset.metric;
                container.querySelectorAll(".chart-metric-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");

                const dimWrap = container.querySelector("#chart-dim-wrap");
                const formatWrap = container.querySelector("#chart-format-wrap");

                if (dimWrap) dimWrap.style.display = activeMetric === "trend" ? "none" : "flex";
                if (formatWrap) formatWrap.style.display = (activeMetric === "assets" || activeMetric === "return") ? "flex" : "none";

                updateHeaderTag();
                renderActiveChart();
            });
        });

        // Format Buttons (Donut vs Bar)
        container.querySelectorAll(".format-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                activeFormat = btn.dataset.format;
                container.querySelectorAll(".format-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                renderActiveChart();
            });
        });
    }

    function updateHeaderTag() {
        const tag = container.querySelector("#chart-tag-info");
        if (!tag) return;
        const dimTitle = activeDimension === "platform" ? "Platform" : (activeDimension === "product" ? "Product" : "Category");
        if (activeMetric === "assets") tag.textContent = `${dimTitle} · Asset Allocation`;
        else if (activeMetric === "return") tag.textContent = `${dimTitle} · Return Distribution`;
        else if (activeMetric === "apr") tag.textContent = `${dimTitle} · APR Comparison`;
        else if (activeMetric === "trend") tag.textContent = "Growth Trajectory";
    }

    function renderActiveChart() {
        const body = container.querySelector("#chart-body");
        if (!body) return;

        // Force reflow and trigger entry animation
        body.classList.remove("chart-canvas-enter");
        void body.offsetWidth;
        body.classList.add("chart-canvas-enter");

        if (activeMetric === "trend") {
            renderLineChart(body);
        } else if (activeMetric === "apr") {
            renderAprRankedChart(body);
        } else if (activeFormat === "bar") {
            renderBarChart(body);
        } else {
            renderDonutChart(body);
        }
    }

    // ── Global Floating Tooltip Singleton ──
    let tooltipEl = document.getElementById("chart-floating-tooltip");
    if (!tooltipEl) {
        tooltipEl = document.createElement("div");
        tooltipEl.id = "chart-floating-tooltip";
        tooltipEl.className = "chart-floating-tooltip";
        document.body.appendChild(tooltipEl);
    }

    function showTooltip(e, data) {
        if (!tooltipEl || !data) return;
        const color = data.color || 'var(--color-brand)';
        let html = `
            <div class="chart-tooltip-header">
                <span class="chart-tooltip-dot" style="background-color:${color};"></span>
                <span class="chart-tooltip-title">${escapeHtml(data.title)}</span>
            </div>
            <div class="chart-tooltip-body">
                <span class="chart-tooltip-amount">${data.amount}</span>
                ${data.percent ? `<span class="chart-tooltip-pct">(${data.percent})</span>` : ''}
            </div>
        `;
        if (data.apr || data.subtitle) {
            html += `
                <div class="chart-tooltip-sub">
                    ${data.apr ? `<span class="chart-tooltip-apr-tag">${data.apr}</span>` : ''}
                    ${data.subtitle ? `<span class="chart-tooltip-sub-text">${data.subtitle}</span>` : ''}
                </div>
            `;
        }
        tooltipEl.innerHTML = html;
        tooltipEl.classList.add("visible");
        positionTooltip(e);
    }

    function positionTooltip(e) {
        if (!tooltipEl || !tooltipEl.classList.contains("visible")) return;
        const pad = 12;
        const tipWidth = tooltipEl.offsetWidth || 190;
        const tipHeight = tooltipEl.offsetHeight || 60;

        let x = e.clientX;
        let y = e.clientY;

        if (x - tipWidth / 2 < pad) {
            x = tipWidth / 2 + pad;
        } else if (x + tipWidth / 2 > window.innerWidth - pad) {
            x = window.innerWidth - tipWidth / 2 - pad;
        }

        if (y - tipHeight - 16 < pad) {
            tooltipEl.style.transform = "translate(-50%, 16px)";
        } else {
            tooltipEl.style.transform = "translate(-50%, -100%) translateY(-10px)";
        }

        tooltipEl.style.left = `${Math.round(x)}px`;
        tooltipEl.style.top = `${Math.round(y)}px`;
    }

    function hideTooltip() {
        if (tooltipEl) {
            tooltipEl.classList.remove("visible");
        }
    }

    // ──────────────────────────────────────────
    // 3. Donut Chart (Assets or Return)
    // ──────────────────────────────────────────
    function renderDonutChart(body) {
        const raw = aggregateData(activeDimension);
        const isReturn = activeMetric === "return";

        // Sort items descending
        const data = raw.filter(d => isReturn ? d.apr_amount_myr > 0 : d.amount_myr > 0)
                        .sort((a, b) => isReturn ? b.apr_amount_myr - a.apr_amount_myr : b.amount_myr - a.amount_myr);

        if (!data.length) {
            body.innerHTML = `
                <div class="chart-empty-state">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <span>No ${isReturn ? 'interest-bearing return' : 'asset allocation'} data available to display</span>
                </div>
            `;
            return;
        }

        const total = data.reduce((sum, d) => sum + (isReturn ? d.apr_amount_myr : d.amount_myr), 0);
        let startAngle = -Math.PI / 2;
        const radius = 105;
        const innerRadius = 55;
        const cx = 130;
        const cy = 130;

        const slicesSvg = data.map((item, i) => {
            const val = isReturn ? item.apr_amount_myr : item.amount_myr;
            const fraction = total > 0 ? val / total : 0;
            const angle = fraction * 2 * Math.PI;
            const endAngle = startAngle + angle;
            const color = PALETTE[i % PALETTE.length];

            const x1 = cx + radius * Math.cos(startAngle);
            const y1 = cy + radius * Math.sin(startAngle);
            const x2 = cx + radius * Math.cos(endAngle);
            const y2 = cy + radius * Math.sin(endAngle);

            const ix1 = cx + innerRadius * Math.cos(endAngle);
            const iy1 = cy + innerRadius * Math.sin(endAngle);
            const ix2 = cx + innerRadius * Math.cos(startAngle);
            const iy2 = cy + innerRadius * Math.sin(startAngle);

            const largeArc = angle > Math.PI ? 1 : 0;
            const pathData = [
                `M ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
                `L ${ix1} ${iy1}`,
                `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2}`,
                `Z`
            ].join(" ");

            startAngle = endAngle;

            return `
                <path class="pie-slice" d="${pathData}" fill="${color}"
                      style="animation-delay: ${i * 35}ms;"
                      data-index="${i}"></path>
            `;
        }).join("");

        const legendHtml = data.map((item, i) => {
            const color = PALETTE[i % PALETTE.length];
            const val = isReturn ? item.apr_amount_myr : item.amount_myr;
            const pct = isReturn ? item.return_percent : item.asset_percent;

            return `
                <div class="pie-legend-item" style="animation-delay: ${i * 28 + 80}ms;" data-index="${i}" title="${escapeHtml(item.label)} · ${formatMYR(val)}">
                    <div class="pie-legend-left">
                        <span class="legend-color-dot" style="background-color:${color};"></span>
                        <span class="pie-legend-label">${escapeHtml(item.label)}</span>
                    </div>
                    <div class="pie-legend-right">
                        <span class="pie-legend-amount">${formatMYR(val)}</span>
                        <span class="pie-legend-percent">${formatPercent(pct)}</span>
                    </div>
                </div>
            `;
        }).join("");

        body.innerHTML = `
            <div class="pie-chart-wrapper">
                <svg class="pie-chart-svg" viewBox="0 0 260 260">
                    <g>${slicesSvg}</g>
                    <text id="donut-center-title" class="donut-center-title" x="${cx}" y="${cy - 6}">
                        ${isReturn ? 'EST. RETURN' : 'TOTAL ASSETS'}
                    </text>
                    <text id="donut-center-val" class="donut-center-val" x="${cx}" y="${cy + 14}">
                        ${formatMYR(total)}
                    </text>
                    <text id="donut-center-sub" class="donut-center-sub" x="${cx}" y="${cy + 28}" style="display:none;"></text>
                </svg>
                <div class="pie-legend-list">${legendHtml}</div>
            </div>
        `;

        function highlightSlice(index, e) {
            const item = data[index];
            if (!item) return;
            const color = PALETTE[index % PALETTE.length];
            const val = isReturn ? item.apr_amount_myr : item.amount_myr;
            const pct = isReturn ? item.return_percent : item.asset_percent;

            // Highlight active slice, dim other slices
            body.querySelectorAll(".pie-slice").forEach((s, idx) => {
                if (idx === index) {
                    s.classList.add("is-active");
                    s.classList.remove("is-dimmed");
                } else {
                    s.classList.add("is-dimmed");
                    s.classList.remove("is-active");
                }
            });

            // Highlight corresponding legend item, dim others
            body.querySelectorAll(".pie-legend-item").forEach((leg, idx) => {
                if (idx === index) {
                    leg.classList.add("is-active");
                    leg.classList.remove("is-dimmed");
                } else {
                    leg.classList.add("is-dimmed");
                    leg.classList.remove("is-active");
                }
            });

            // Update Donut Center dynamically
            const centerTitle = body.querySelector("#donut-center-title");
            const centerVal = body.querySelector("#donut-center-val");
            const centerSub = body.querySelector("#donut-center-sub");
            if (centerTitle && centerVal && centerSub) {
                const shortName = item.label.length > 14 ? item.label.substring(0, 13) + '…' : item.label;
                centerTitle.textContent = shortName;
                centerTitle.classList.add("is-active");
                centerVal.textContent = formatMYR(val);
                centerSub.textContent = `${formatPercent(pct)} of total`;
                centerSub.style.display = "";
            }

            // Show rich floating tooltip
            showTooltip(e, {
                color: color,
                title: item.label,
                amount: formatMYR(val),
                percent: formatPercent(pct),
                apr: `${formatPercent(item.apr_rate)} APR`,
                subtitle: isReturn ? `Principal: ${formatMYR(item.amount_myr)}` : `Return: ${formatMYR(item.apr_amount_myr)}/yr`
            });
        }

        function resetSlice() {
            body.querySelectorAll(".pie-slice").forEach(s => {
                s.classList.remove("is-active", "is-dimmed");
            });
            body.querySelectorAll(".pie-legend-item").forEach(leg => {
                leg.classList.remove("is-active", "is-dimmed");
            });

            const centerTitle = body.querySelector("#donut-center-title");
            const centerVal = body.querySelector("#donut-center-val");
            const centerSub = body.querySelector("#donut-center-sub");
            if (centerTitle && centerVal && centerSub) {
                centerTitle.textContent = isReturn ? 'EST. RETURN' : 'TOTAL ASSETS';
                centerTitle.classList.remove("is-active");
                centerVal.textContent = formatMYR(total);
                centerSub.textContent = "";
                centerSub.style.display = "none";
            }

            hideTooltip();
        }

        body.querySelectorAll(".pie-slice").forEach((slice, i) => {
            slice.addEventListener("mouseenter", (e) => highlightSlice(i, e));
            slice.addEventListener("mousemove", (e) => positionTooltip(e));
            slice.addEventListener("mouseleave", resetSlice);
        });

        body.querySelectorAll(".pie-legend-item").forEach((leg, i) => {
            leg.addEventListener("mouseenter", (e) => highlightSlice(i, e));
            leg.addEventListener("mousemove", (e) => positionTooltip(e));
            leg.addEventListener("mouseleave", resetSlice);
        });
    }

    // ──────────────────────────────────────────
    // 4. Vertical Bar Chart (Assets or Return)
    // ──────────────────────────────────────────
    function renderBarChart(body) {
        const raw = aggregateData(activeDimension);
        const isReturn = activeMetric === "return";

        const data = raw.filter(d => isReturn ? d.apr_amount_myr > 0 : d.amount_myr > 0)
                        .sort((a, b) => isReturn ? b.apr_amount_myr - a.apr_amount_myr : b.amount_myr - a.amount_myr)
                        .slice(0, 10); // Top 10

        if (!data.length) {
            body.innerHTML = `
                <div class="chart-empty-state">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                    <span>No data available for bar chart comparison</span>
                </div>
            `;
            return;
        }

        const maxVal = Math.max(...data.map(d => isReturn ? d.apr_amount_myr : d.amount_myr)) * 1.15;
        const width = 800;
        const height = 280;
        const paddingLeft = 65;
        const paddingRight = 30;
        const paddingTop = 20;
        const paddingBottom = 45;
        const chartW = width - paddingLeft - paddingRight;
        const chartH = height - paddingTop - paddingBottom;

        const barWidth = Math.min(48, Math.max(18, (chartW / data.length) * 0.65));
        const step = chartW / data.length;

        // Grid lines
        const gridSteps = 4;
        let gridLinesSvg = "";
        for (let i = 0; i <= gridSteps; i++) {
            const yVal = (maxVal / gridSteps) * i;
            const yPos = paddingTop + chartH - (i / gridSteps) * chartH;
            gridLinesSvg += `
                <line class="chart-grid-line" x1="${paddingLeft}" y1="${yPos}" x2="${width - paddingRight}" y2="${yPos}" />
                <text class="chart-axis-text" x="${paddingLeft - 10}" y="${yPos + 4}" text-anchor="end">${formatMYR(yVal).replace('.00', '')}</text>
            `;
        }

        // Bars
        const barsSvg = data.map((item, i) => {
            const val = isReturn ? item.apr_amount_myr : item.amount_myr;
            const bH = maxVal > 0 ? (val / maxVal) * chartH : 0;
            const xPos = paddingLeft + i * step + (step - barWidth) / 2;
            const yPos = paddingTop + chartH - bH;
            const color = PALETTE[i % PALETTE.length];

            // Short label for axis
            const rawLabel = item.label;
            const shortLabel = rawLabel.length > 10 ? rawLabel.substring(0, 9) + '…' : rawLabel;

            return `
                <rect class="bar-rect" x="${xPos}" y="${yPos}" width="${barWidth}" height="${bH}" rx="4"
                      style="animation-delay: ${i * 45}ms;"
                      fill="${color}" data-index="${i}" />
                <text class="chart-axis-text bar-axis-label" style="animation-delay: ${i * 45 + 100}ms;" x="${xPos + barWidth / 2}" y="${height - 18}" text-anchor="middle">
                    ${escapeHtml(shortLabel)}
                </text>
            `;
        }).join("");

        body.innerHTML = `
            <div class="bar-chart-container">
                <svg class="chart-svg-root" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
                    ${gridLinesSvg}
                    ${barsSvg}
                </svg>
            </div>
        `;

        body.querySelectorAll(".bar-rect").forEach((bar, i) => {
            const item = data[i];
            const color = PALETTE[i % PALETTE.length];
            const val = isReturn ? item.apr_amount_myr : item.amount_myr;
            const pct = isReturn ? item.return_percent : item.asset_percent;

            bar.addEventListener("mouseenter", (e) => {
                body.querySelectorAll(".bar-rect").forEach((b, idx) => {
                    if (idx === i) {
                        b.classList.add("is-active");
                        b.classList.remove("is-dimmed");
                    } else {
                        b.classList.add("is-dimmed");
                        b.classList.remove("is-active");
                    }
                });
                showTooltip(e, {
                    color: color,
                    title: item.label,
                    amount: formatMYR(val),
                    percent: formatPercent(pct),
                    apr: `${formatPercent(item.apr_rate)} APR`,
                    subtitle: isReturn ? `Principal: ${formatMYR(item.amount_myr)}` : `Return: ${formatMYR(item.apr_amount_myr)}/yr`
                });
            });
            bar.addEventListener("mousemove", (e) => positionTooltip(e));
            bar.addEventListener("mouseleave", () => {
                body.querySelectorAll(".bar-rect").forEach(b => b.classList.remove("is-active", "is-dimmed"));
                hideTooltip();
            });
        });
    }

    // ──────────────────────────────────────────
    // 5. APR Rate Comparison (Ranked Horizontal Bars)
    // ──────────────────────────────────────────
    function renderAprRankedChart(body) {
        const raw = aggregateData(activeDimension);
        const data = raw.sort((a, b) => b.apr_rate - a.apr_rate);

        if (!data.length || data.every(d => d.apr_rate <= 0)) {
            body.innerHTML = `
                <div class="chart-empty-state">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                    <span>No interest-bearing assets with positive APR rates found</span>
                </div>
            `;
            return;
        }

        const maxRate = Math.max(15, Math.max(...data.map(d => d.apr_rate)) * 1.1);
        const portfolioRoi = portfolio.weighted_roi || 0;

        const rowsHtml = data.map((item, i) => {
            const fillWidth = maxRate > 0 ? Math.min(100, (item.apr_rate / maxRate) * 100) : 0;
            const color = item.apr_rate >= 5.0 ? 'var(--color-profit)' : (item.apr_rate > 0 ? 'var(--color-brand)' : 'var(--text-placeholder)');

            return `
                <div class="ranked-bar-row" style="animation-delay: ${i * 40}ms;" data-index="${i}">
                    <div class="ranked-bar-label">
                        <span class="ranked-bar-rank">#${i + 1}</span>
                        <span title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
                    </div>
                    <div class="ranked-bar-track">
                        <div class="ranked-bar-fill" style="width: ${fillWidth}%; background-color: ${color}; animation-delay: ${i * 40 + 80}ms;"></div>
                    </div>
                    <div class="ranked-bar-values">
                        <span class="ranked-bar-rate" style="color: ${color};">${formatPercent(item.apr_rate)}</span>
                        <span class="ranked-bar-sub">${formatMYR(item.apr_amount_myr)}/yr</span>
                    </div>
                </div>
            `;
        }).join("");

        body.innerHTML = `
            <div class="ranked-bars-wrapper">
                <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:8px; border-bottom:1px solid var(--border-default); font-size:11px; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em;">
                    <span>${activeDimension.toUpperCase()} NAME</span>
                    <span style="display:flex; align-items:center; gap:8px;">
                        <span>Weighted Portfolio ROI Benchmark: <strong style="color:var(--color-brand); font-variant-numeric:tabular-nums;">${formatPercent(portfolioRoi)}</strong></span>
                    </span>
                    <span style="text-align:right;">APR & RETURN</span>
                </div>
                ${rowsHtml}
            </div>
        `;

        body.querySelectorAll(".ranked-bar-row").forEach((row, i) => {
            const item = data[i];
            const color = item.apr_rate >= 5.0 ? 'var(--color-profit)' : (item.apr_rate > 0 ? 'var(--color-brand)' : 'var(--text-placeholder)');

            row.addEventListener("mouseenter", (e) => {
                showTooltip(e, {
                    color: color,
                    title: item.label,
                    amount: `${formatPercent(item.apr_rate)} APR`,
                    apr: `Yield: ${formatMYR(item.apr_amount_myr)}/yr`,
                    subtitle: `Total Balance: ${formatMYR(item.amount_myr)}`
                });
            });
            row.addEventListener("mousemove", (e) => positionTooltip(e));
            row.addEventListener("mouseleave", hideTooltip);
        });
    }

    // ──────────────────────────────────────────
    // 6. Line Chart (Monthly Net Worth Growth)
    // ──────────────────────────────────────────
    function renderLineChart(body) {
        const data = historySnapshots;

        if (!data || data.length < 2) {
            body.innerHTML = `
                <div class="chart-empty-state">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                    <span>At least 2 monthly snapshots are required to plot growth trajectory</span>
                    <span style="font-size:11px;">Save and archive monthly snapshots to construct your quantitative net worth curve.</span>
                </div>
            `;
            return;
        }

        const maxVal = Math.max(...data.map(d => d.total_net_worth_myr)) * 1.15;
        const minVal = Math.min(...data.map(d => d.total_net_worth_myr)) * 0.85;
        const valRange = Math.max(1, maxVal - minVal);

        const width = 800;
        const height = 280;
        const paddingLeft = 70;
        const paddingRight = 40;
        const paddingTop = 25;
        const paddingBottom = 40;
        const chartW = width - paddingLeft - paddingRight;
        const chartH = height - paddingTop - paddingBottom;

        const step = chartW / (data.length - 1);

        const points = data.map((d, i) => {
            const x = paddingLeft + i * step;
            const y = paddingTop + chartH - ((d.total_net_worth_myr - minVal) / valRange) * chartH;
            return { x, y, data: d };
        });

        const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(" ");
        const areaPath = `
            ${linePath}
            L ${points[points.length - 1].x} ${paddingTop + chartH}
            L ${points[0].x} ${paddingTop + chartH}
            Z
        `;

        // Horizontal grid lines
        const gridSteps = 4;
        let gridLinesSvg = "";
        for (let i = 0; i <= gridSteps; i++) {
            const yVal = minVal + (valRange / gridSteps) * i;
            const yPos = paddingTop + chartH - (i / gridSteps) * chartH;
            gridLinesSvg += `
                <line class="chart-grid-line" x1="${paddingLeft}" y1="${yPos}" x2="${width - paddingRight}" y2="${yPos}" />
                <text class="chart-axis-text" x="${paddingLeft - 10}" y="${yPos + 4}" text-anchor="end">${formatMYR(yVal).replace('.00', '')}</text>
            `;
        }

        // Data points & X-axis labels
        const pointsSvg = points.map((p, i) => {
            return `
                <circle class="line-chart-point" style="animation-delay: ${280 + i * 70}ms;" cx="${p.x}" cy="${p.y}" r="4" data-index="${i}" />
                <text class="chart-axis-text" x="${p.x}" y="${height - 15}" text-anchor="middle">${p.data.month}</text>
            `;
        }).join("");

        body.innerHTML = `
            <div class="bar-chart-container">
                <svg class="chart-svg-root" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
                    <defs>
                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="var(--color-brand)" stop-opacity="0.28" />
                            <stop offset="100%" stop-color="var(--color-brand)" stop-opacity="0.0" />
                        </linearGradient>
                    </defs>
                    ${gridLinesSvg}
                    <path class="line-chart-area" d="${areaPath}" />
                    <path class="line-chart-path" d="${linePath}" />
                    ${pointsSvg}
                </svg>
            </div>
        `;

        body.querySelectorAll(".line-chart-point").forEach((pt, i) => {
            const d = points[i].data;
            pt.addEventListener("mouseenter", (e) => {
                pt.classList.add("is-active");
                showTooltip(e, {
                    color: "var(--color-brand)",
                    title: `Month: ${d.month}`,
                    amount: formatMYR(d.total_net_worth_myr),
                    subtitle: (d.usd_rate || window.VEYRA_FX?.USDMYR)
                        ? `FX Benchmark: 1 USD = ${Number(d.usd_rate || window.VEYRA_FX.USDMYR).toFixed(4)} MYR`
                        : `FX Benchmark: —`
                });
            });
            pt.addEventListener("mousemove", (e) => positionTooltip(e));
            pt.addEventListener("mouseleave", () => {
                pt.classList.remove("is-active");
                hideTooltip();
            });
        });
    }

    renderShell();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/"/g, '&quot;');
}
