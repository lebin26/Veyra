/**
 * wealth/js/components/rateModal.js
 * Quick modal for updating the USD/MYR exchange rate
 */
import { WealthApi } from '../core/api.js';

export function openRateModal(currentRate, onSaved) {
    const existing = document.getElementById("rate-modal");
    if (existing) existing.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "rate-modal";
    backdrop.className = "modal-backdrop open";

    backdrop.innerHTML = `
        <div class="modal-panel" style="max-width: 360px;">
            <div class="modal-header">
                <span class="modal-title">USD / MYR FX Rate</span>
                <button type="button" class="modal-close-btn" id="modal-close">✕</button>
            </div>

            <form id="rate-form">
                <div class="modal-body">
                    <p style="font-size:12px; color:var(--text-secondary); line-height:1.4;">
                        Foreign currency balances (such as USD trading or crypto accounts) are converted to MYR using this benchmark rate.
                    </p>
                    <div class="form-group">
                        <label class="form-label" for="rate-val-input">Exchange Rate (1 USD = X MYR)</label>
                        <input type="number" id="rate-val-input" class="form-input tabular-nums" step="0.0001" min="0.1" value="${currentRate}" required autofocus>
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Update Rate</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(backdrop);

    const closeBtn = backdrop.querySelector("#modal-close");
    const cancelBtn = backdrop.querySelector("#modal-cancel");
    const form = backdrop.querySelector("#rate-form");

    function closeModal() {
        backdrop.classList.remove("open");
        setTimeout(() => backdrop.remove(), 200);
    }

    closeBtn.addEventListener("click", closeModal);
    cancelBtn.addEventListener("click", closeModal);
    backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeModal();
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newRate = Number(backdrop.querySelector("#rate-val-input").value);
        if (!newRate || newRate <= 0) return;

        try {
            await WealthApi.saveSettings({ default_usd_rate: newRate });
            closeModal();
            if (typeof onSaved === 'function') onSaved(newRate);
        } catch (err) {
            alert(err.message || "Failed to update rate");
        }
    });
}
