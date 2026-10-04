/**
 * wealth/js/components/snapshotModal.js
 * Monthly Asset Snapshot Manager & Historical Archives
 */
import { formatMYR, formatPercent } from '../core/math.js';
import { WealthApi } from '../core/api.js';

export function openSnapshotModal(month, currentNetWorth, currentUsdRate, onSaved) {
    const existing = document.getElementById("snapshot-modal");
    if (existing) existing.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "snapshot-modal";
    backdrop.className = "modal-backdrop open";

    backdrop.innerHTML = `
        <div class="modal-panel" style="max-width: 500px;">
            <div class="modal-header">
                <span class="modal-title">Monthly Net Worth Snapshot</span>
                <button type="button" class="modal-close-btn" id="modal-close">✕</button>
            </div>

            <div class="modal-body">
                <p style="font-size:12px; color:var(--text-secondary); line-height:1.5;">
                    A snapshot archives your total net worth and asset breakdown for a specific month, enabling monthly growth comparisons (Δ RM / Growth %) and historical charts.
                </p>

                <!-- Current Snapshot Summary -->
                <div class="snapshot-meta-box">
                    <div class="snapshot-stat-row">
                        <span class="snapshot-stat-label">Snapshot Month:</span>
                        <span class="snapshot-stat-val" id="snap-month-display">${month}</span>
                    </div>
                    <div class="snapshot-stat-row">
                        <span class="snapshot-stat-label">Current Live Net Worth:</span>
                        <span class="snapshot-stat-val" style="color:var(--color-profit);">${formatMYR(currentNetWorth)}</span>
                    </div>
                </div>

                <!-- Snapshot Form -->
                <form id="snapshot-form" style="display:flex; flex-direction:column; gap:14px;">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="snap-month-input">Target Month</label>
                            <input type="month" id="snap-month-input" class="form-input" value="${month}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="snap-rate-display">USD/MYR Benchmark</label>
                            <input type="text" id="snap-rate-display" class="form-input tabular-nums" value="${(typeof currentUsdRate === 'number' && currentUsdRate > 0) ? `1 USD = ${currentUsdRate.toFixed(4)} MYR` : (window.VEYRA_FX?.USDMYR ? `1 USD = ${window.VEYRA_FX.USDMYR.toFixed(4)} MYR` : 'Automated FX rate')}" readonly disabled style="opacity:0.85; cursor:not-allowed; background:var(--fill-subtle);">
                            <input type="hidden" id="snap-rate-input" value="${(typeof currentUsdRate === 'number' && currentUsdRate > 0) ? currentUsdRate : (window.VEYRA_FX?.USDMYR || '')}">
                        </div>
                    </div>

                    <label class="checkbox-row">
                        <input type="checkbox" id="snap-copy-checkbox">
                        <div>
                            <div class="checkbox-text">Copy from previous month's snapshot if portfolio is empty</div>
                            <div class="checkbox-sub">Allows rapid fine-tuning of existing assets without re-entering from scratch.</div>
                        </div>
                    </label>

                    <div class="form-group">
                        <label class="form-label" for="snap-notes">Snapshot Note (Optional)</label>
                        <input type="text" id="snap-notes" class="form-input" placeholder="e.g. End of month rebalance, Bonus payout">
                    </div>

                    <button type="submit" class="btn btn-primary" style="justify-content:center; padding:10px;">
                        Save Monthly Snapshot
                    </button>
                </form>

                <!-- History list of snapshots -->
                <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                    <span style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em;">
                        Historical Archive
                    </span>
                    <div id="snapshots-history-list" style="display:flex; flex-direction:column; gap:6px; max-height:160px; overflow-y:auto;">
                        <div style="font-size:12px; color:var(--text-placeholder); text-align:center; padding:12px;">Loading history...</div>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" id="modal-cancel">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);

    const closeBtn = backdrop.querySelector("#modal-close");
    const cancelBtn = backdrop.querySelector("#modal-cancel");
    const form = backdrop.querySelector("#snapshot-form");
    const historyList = backdrop.querySelector("#snapshots-history-list");

    function closeModal() {
        backdrop.classList.remove("open");
        setTimeout(() => backdrop.remove(), 200);
    }

    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);
    backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeModal();
    });

    async function loadHistory() {
        try {
            const res = await WealthApi.getSnapshots();
            const snaps = res.snapshots || [];
            if (!snaps.length) {
                historyList.innerHTML = `<div style="font-size:12px; color:var(--text-placeholder); text-align:center; padding:12px;">No archived snapshots yet</div>`;
                return;
            }

            historyList.innerHTML = snaps.map(s => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:var(--fill-subtle); border-radius:6px; font-size:12px;">
                    <span style="font-weight:600;">${s.month}</span>
                    <div style="display:flex; gap:12px; align-items:center;">
                        <span class="tabular-nums" style="font-weight:700;">${formatMYR(s.total_net_worth_myr)}</span>
                        <span style="color:var(--color-profit); font-size:11px;">(${formatPercent(s.weighted_roi)})</span>
                    </div>
                </div>
            `).join("");
        } catch (_) {
            historyList.innerHTML = `<div style="font-size:12px; color:var(--text-placeholder); text-align:center; padding:12px;">Failed to load history</div>`;
        }
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const targetMonth = backdrop.querySelector("#snap-month-input").value;
        const usdRate = Number(backdrop.querySelector("#snap-rate-input").value);
        const copyFromLast = backdrop.querySelector("#snap-copy-checkbox").checked;
        const notes = backdrop.querySelector("#snap-notes").value;

        try {
            await WealthApi.createSnapshot({
                month: targetMonth,
                usd_rate: usdRate,
                copy_from_last: copyFromLast,
                notes
            });
            closeModal();
            if (typeof onSaved === 'function') onSaved(targetMonth);
        } catch (err) {
            alert(err.message || "Failed to create snapshot");
        }
    });

    loadHistory();
}
