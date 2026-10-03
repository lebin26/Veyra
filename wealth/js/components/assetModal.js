/**
 * wealth/js/components/assetModal.js
 * Modal for creating and editing individual portfolio assets
 */
import { WealthApi } from '../core/api.js';

const PLATFORM_SUGGESTIONS = [
    "Touch 'n Go", "Hong Leong Bank", "Maybank", "CIMB", "Public Bank",
    "Bybit", "Binance", "Luno", "myASNB", "Rize", "Versa",
    "Aeon Wallet", "Shopee Pay", "Ryt Bank", "Seter", "VT Markets", "Vantage"
];

export function openAssetModal(asset = null, onSaved) {
    const existing = document.getElementById("asset-modal");
    if (existing) existing.remove();

    const isEdit = !!asset;
    const backdrop = document.createElement("div");
    backdrop.id = "asset-modal";
    backdrop.className = "modal-backdrop open";

    backdrop.innerHTML = `
        <div class="modal-panel" style="max-width: 480px;">
            <div class="modal-header">
                <span class="modal-title">${isEdit ? 'Edit Asset Holding' : 'Add New Asset Holding'}</span>
                <button type="button" class="modal-close-btn" id="modal-close">✕</button>
            </div>

            <form id="asset-form">
                <div class="modal-body">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="acc-platform">Platform / Institution</label>
                            <input type="text" id="acc-platform" class="form-input" list="platform-list" placeholder="e.g. Bybit, Touch 'n Go" required value="${isEdit ? escapeHtml(asset.platform) : ''}">
                            <datalist id="platform-list">
                                ${PLATFORM_SUGGESTIONS.map(p => `<option value="${p}"></option>`).join('')}
                            </datalist>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="acc-product">Product / Account</label>
                            <input type="text" id="acc-product" class="form-input" placeholder="e.g. GO+, Mantle Vault, e-FD" required value="${isEdit ? escapeHtml(asset.product) : ''}">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="acc-category">Asset Category</label>
                            <select id="acc-category" class="form-select">
                                <option value="bank" ${isEdit && asset.category === 'bank' ? 'selected' : ''}>Bank Deposit</option>
                                <option value="cash" ${isEdit && asset.category === 'cash' ? 'selected' : ''}>Cash / E-Wallet</option>
                                <option value="crypto" ${isEdit && asset.category === 'crypto' ? 'selected' : ''}>Cryptocurrency</option>
                                <option value="investment" ${isEdit && asset.category === 'investment' ? 'selected' : ''}>Investment / Mutual Fund</option>
                                <option value="trading" ${isEdit && asset.category === 'trading' ? 'selected' : ''}>Trading Account</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="acc-currency">Currency</label>
                            <select id="acc-currency" class="form-select">
                                <option value="MYR" ${!isEdit || asset.currency === 'MYR' ? 'selected' : ''}>MYR (Ringgit)</option>
                                <option value="USD" ${isEdit && asset.currency === 'USD' ? 'selected' : ''}>USD (US Dollar)</option>
                                <option value="SGD" ${isEdit && asset.currency === 'SGD' ? 'selected' : ''}>SGD (SG Dollar)</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label" for="acc-amount">Balance (Original Currency)</label>
                            <input type="number" id="acc-amount" class="form-input tabular-nums" step="0.01" min="0" placeholder="0.00" required value="${isEdit ? asset.amount : ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="acc-apr">Annual APR (%)</label>
                            <input type="number" id="acc-apr" class="form-input tabular-nums" step="0.01" min="0" max="100" placeholder="0.00" value="${isEdit ? asset.apr : '0.00'}">
                            <span class="form-help">e.g. 3.5 for 3.50% annual yield</span>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label" for="acc-notes">Notes (Optional)</label>
                        <input type="text" id="acc-notes" class="form-input" placeholder="e.g. 3-month fixed deposit, Staking" value="${isEdit && asset.notes ? escapeHtml(asset.notes) : ''}">
                    </div>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Asset'}</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(backdrop);

    const closeBtn = backdrop.querySelector("#modal-close");
    const cancelBtn = backdrop.querySelector("#modal-cancel");
    const form = backdrop.querySelector("#asset-form");

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
        const payload = {
            platform: backdrop.querySelector("#acc-platform").value.trim(),
            product: backdrop.querySelector("#acc-product").value.trim(),
            category: backdrop.querySelector("#acc-category").value,
            currency: backdrop.querySelector("#acc-currency").value,
            amount: Number(backdrop.querySelector("#acc-amount").value) || 0,
            apr: Number(backdrop.querySelector("#acc-apr").value) || 0,
            notes: backdrop.querySelector("#acc-notes").value.trim() || null
        };

        try {
            if (isEdit) {
                await WealthApi.updateAccount(asset.id, payload);
            } else {
                await WealthApi.createAccount(payload);
            }
            closeModal();
            if (typeof onSaved === 'function') onSaved();
        } catch (err) {
            alert(err.message || "Failed to save asset");
        }
    });
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
