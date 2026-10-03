/**
 * wealth/js/components/monthCalendar.js
 * 12-Month Calendar & Archive Matrix Management Component
 * Allows visual inspection, adding, switching, and deleting of monthly asset records.
 * Prominently highlights the Current Real-World Month and provides one-click jump.
 */
import { formatMYR, formatPercent, getCurrentMonthStr } from '../core/math.js';

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export function renderMonthCalendar(container, options = {}) {
    if (!container) return;

    const realCurrentMonth = options.realCurrentMonth || getCurrentMonthStr();
    const {
        activeMonth = realCurrentMonth,
        historySnapshots = [],
        onSelectMonth = () => {},
        onDeleteMonth = () => {},
        onInitMonth = () => {}
    } = options;

    let selectedYear = parseInt(activeMonth.split('-')[0], 10) || parseInt(realCurrentMonth.split('-')[0], 10) || new Date().getFullYear();

    function render() {
        // Map snapshots by month string YYYY-MM
        const snapshotMap = {};
        (historySnapshots || []).forEach(s => {
            snapshotMap[s.month] = s;
        });

        // Compute year recorded count
        const monthsInYear = Array.from({ length: 12 }, (_, i) => {
            const mStr = String(i + 1).padStart(2, '0');
            return `${selectedYear}-${mStr}`;
        });

        const recordedMonths = monthsInYear.filter(m => snapshotMap[m]);

        container.innerHTML = `
            <div class="calendar-section">
                <!-- Calendar Header -->
                <div class="calendar-top-header">
                    <div class="year-nav-group">
                        <button type="button" class="year-step-btn" id="cal-prev-year" title="Previous Year">◀</button>
                        <span class="year-display-title">${selectedYear}</span>
                        <button type="button" class="year-step-btn" id="cal-next-year" title="Next Year">▶</button>
                        <span class="section-count-tag" style="margin-left: 6px;">
                            ${recordedMonths.length} / 12 Months Recorded
                        </span>
                    </div>

                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-secondary" id="cal-jump-current-btn" style="font-size:11px; padding:5px 12px; gap:6px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                            Jump to Current Month (${realCurrentMonth})
                        </button>
                        <span style="font-size:12px; color:var(--text-secondary);">Click any month card to view/edit</span>
                    </div>
                </div>

                <!-- 12-Month Matrix Grid -->
                <div class="months-matrix-grid">
                    ${monthsInYear.map((mStr, idx) => {
                        const mName = MONTH_NAMES[idx];
                        const data = snapshotMap[mStr];
                        const isRealCurrent = mStr === realCurrentMonth;
                        const isViewing = mStr === activeMonth;

                        if (data) {
                            let pillLabel = "Archived";
                            let pillClass = "pill-archived";

                            if (isRealCurrent) {
                                pillLabel = "★ Current (本月)";
                                pillClass = "pill-current";
                            } else if (isViewing) {
                                pillLabel = "Viewing (查看中)";
                                pillClass = "pill-selected";
                            }

                            return `
                                <div class="month-matrix-card ${isViewing ? 'card-selected' : ''} ${isRealCurrent ? 'is-real-current' : ''}" data-month="${mStr}">
                                    <div class="month-card-header">
                                        <span class="month-card-name">
                                            <span>${String(idx + 1).padStart(2, '0')}</span>
                                            <span>${mName}</span>
                                        </span>
                                        <span class="month-status-pill ${pillClass}">${pillLabel}</span>
                                    </div>

                                    <div class="month-card-body">
                                        <div class="month-card-worth">${formatMYR(data.total_net_worth_myr)}</div>
                                        <div class="month-card-substats">
                                            <span style="color:var(--color-profit); font-weight:600;">${formatPercent(data.weighted_roi)} Yield</span>
                                            <span>·</span>
                                            <span>${data.items_count !== undefined ? `${data.items_count} Assets` : 'Archived'}</span>
                                        </div>
                                    </div>

                                    <div class="month-card-footer">
                                        <button type="button" class="month-card-btn-view btn-open-month" data-month="${mStr}">
                                            ${isViewing ? 'Currently Viewing' : 'Switch & Edit →'}
                                        </button>
                                        <button type="button" class="month-card-btn-delete btn-del-month" data-month="${mStr}" title="Delete month archive">
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            `;
                        } else {
                            if (isRealCurrent) {
                                return `
                                    <div class="month-matrix-card card-empty is-real-current btn-init-month" data-month="${mStr}" title="Click to record current month">
                                        <div class="month-card-header" style="width:100%;">
                                            <span class="month-card-name">
                                                <span>${String(idx + 1).padStart(2, '0')}</span>
                                                <span>${mName}</span>
                                            </span>
                                            <span class="month-status-pill pill-current">★ Current (本月)</span>
                                        </div>
                                        <div style="font-weight:600; font-size:12px; color:var(--text-primary); margin:8px 0;">
                                            Awaiting Monthly Balance
                                        </div>
                                        <button type="button" class="btn btn-primary" style="font-size:11px; padding:4px 10px;">
                                            + Record Assets
                                        </button>
                                    </div>
                                `;
                            }

                            return `
                                <div class="month-matrix-card card-empty btn-init-month" data-month="${mStr}">
                                    <div style="font-weight:700; font-size:13px; color:var(--text-secondary);">
                                        ${String(idx + 1).padStart(2, '0')} ${mName}
                                    </div>
                                    <div style="font-size:11px;">No records</div>
                                    <button type="button" class="empty-month-btn">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        + Initialize
                                    </button>
                                </div>
                            `;
                        }
                    }).join("")}
                </div>
            </div>
        `;

        bindEvents();
    }

    function bindEvents() {
        const prevYear = container.querySelector("#cal-prev-year");
        const nextYear = container.querySelector("#cal-next-year");

        if (prevYear) {
            prevYear.addEventListener("click", () => {
                selectedYear -= 1;
                render();
            });
        }

        if (nextYear) {
            nextYear.addEventListener("click", () => {
                selectedYear += 1;
                render();
            });
        }

        // Jump to current month button
        const jumpCurrentBtn = container.querySelector("#cal-jump-current-btn");
        if (jumpCurrentBtn) {
            jumpCurrentBtn.addEventListener("click", () => {
                const currentYear = parseInt(realCurrentMonth.split('-')[0], 10);
                if (selectedYear !== currentYear) {
                    selectedYear = currentYear;
                }
                onSelectMonth(realCurrentMonth);
            });
        }

        // Switch to month
        container.querySelectorAll(".btn-open-month").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const m = btn.dataset.month;
                onSelectMonth(m);
            });
        });

        // Click whole card to open month
        container.querySelectorAll(".month-matrix-card:not(.card-empty)").forEach(card => {
            card.addEventListener("click", () => {
                const m = card.dataset.month;
                onSelectMonth(m);
            });
        });

        // Initialize empty month
        container.querySelectorAll(".btn-init-month").forEach(btn => {
            btn.addEventListener("click", () => {
                const m = btn.dataset.month;
                onInitMonth(m);
            });
        });

        // Delete month
        container.querySelectorAll(".btn-del-month").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const m = btn.dataset.month;
                if (confirm(`Are you sure you want to permanently delete archive for ${m}?`)) {
                    onDeleteMonth(m);
                }
            });
        });
    }

    render();
}
