/**
 * wealth/js/components/templateModal.js
 * Quick Template Batch Entry Modal
 * Allows users to fetch the previous month's holdings as a reusable template,
 * rapidly update balances in one screen, and batch-save the new month in one click.
 */
import { formatMYR, formatCurrencyByCode, formatPercent } from '../core/math.js';
import { WealthApi } from '../core/api.js';
import { trapFocus } from '../../../js/utils/focusTrap.js';

export function openTemplateModal(targetMonth, templateData, onSaved) {
    const triggerEl = document.activeElement;
    const existing = document.getElementById("template-modal");
    if (existing) existing.remove();

    const { sourceMonth, items: initialItems = [], usdRate = null } = templateData;
    const effectiveRate = (typeof usdRate === 'number' && usdRate > 0)
        ? usdRate
        : (window.VEYRA_FX?.USDMYR || 1.0);

    // Working copy of items to allow in-modal additions/removals
    let workingItems = initialItems.map(item => ({
        platform: item.platform || 'Other',
        product: item.product || 'Account',
        category: item.category || 'bank',
        currency: (item.currency || 'MYR').toUpperCase(),
        amount: Math.max(0, Number(item.amount) || 0),
        apr: Math.max(0, Number(item.apr) || 0)
    }));

    const backdrop = document.createElement("div");
    backdrop.id = "template-modal";
    backdrop.className = "modal-backdrop open";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-labelledby", "template-modal-title");

    function computeTotals() {
        let totalMyr = 0;
        let totalAprMyr = 0;
        workingItems.forEach(item => {
            const amt = Math.max(0, Number(item.amount) || 0);
            const r = item.currency === 'USD' ? effectiveRate : 1.0;
            const myr = amt * r;
            totalMyr += myr;
            totalAprMyr += (myr * (item.apr || 0)) / 100;
        });
        return { totalMyr, totalAprMyr };
    }

    function renderContent() {
        const { totalMyr, totalAprMyr } = computeTotals();

        backdrop.innerHTML = `
            <div class="modal-panel template-modal-panel" style="max-width: 760px; width: 100%;">
                <div class="modal-header">
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <span class="modal-title" style="display:flex; align-items:center; gap:8px;">
                            <span>⚡ 快速填写新月份资产 · ${escapeHtml(targetMonth)}</span>
                            <span class="category-tag category-trading" style="font-size:10.5px; text-transform:uppercase;">模板来源: ${escapeHtml(sourceMonth)}</span>
                        </span>
                        <span style="font-size:11.5px; color:var(--text-secondary); line-height:1.4;">
                            已自动导入 ${escapeHtml(sourceMonth)} 的标的清单。直接在右侧输入本月金额即可一次性完成录入。
                        </span>
                    </div>
                    <button type="button" class="modal-close-btn" id="modal-close" aria-label="Close">✕</button>
                </div>

                <div class="modal-body" style="padding: 16px 20px; display:flex; flex-direction:column; gap:14px;">
                    <!-- Quick Actions Bar & Live Summary -->
                    <div class="template-quick-bar" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:10px 14px; background:var(--fill-subtle); border-radius:var(--radius-control); border:1px solid var(--border-default);">
                        <div style="display:flex; gap:8px;">
                            <button type="button" id="btn-keep-last" class="btn btn-secondary" style="padding:4px 10px; font-size:11.5px;" title="Reset all inputs to match last month amounts">
                                ↺ 保持上月金额
                            </button>
                            <button type="button" id="btn-clear-all" class="btn btn-secondary" style="padding:4px 10px; font-size:11.5px;" title="Set all new amounts to 0">
                                ∅ 全部清零
                            </button>
                        </div>
                        <div id="template-live-summary" style="font-size:12px; font-weight:600; font-variant-numeric:tabular-nums; display:flex; align-items:center; gap:12px; color:var(--text-primary);">
                            <span>共 <strong>${workingItems.length}</strong> 项标的</span>
                            <span style="color:var(--text-secondary);">|</span>
                            <span>预计净值: <span style="color:var(--color-brand);">${formatMYR(totalMyr)}</span></span>
                            <span style="color:var(--text-secondary);">|</span>
                            <span>预估年收益: <span style="color:var(--color-profit);">${formatMYR(totalAprMyr)}</span></span>
                        </div>
                    </div>

                    <!-- Items Table -->
                    <div class="table-responsive-wrapper" style="max-height: 50vh; overflow-y: auto; border:1px solid var(--border-default); border-radius:var(--radius-control);">
                        <table class="portfolio-table" style="font-size:12px; margin:0;">
                            <thead>
                                <tr>
                                    <th style="padding:8px 12px;">标的 / 平台</th>
                                    <th style="padding:8px 10px;">类别</th>
                                    <th style="padding:8px 10px;">币种</th>
                                    <th style="padding:8px 10px; text-align:right;">预期 APR</th>
                                    <th style="padding:8px 12px; text-align:right;">上月金额 (${escapeHtml(sourceMonth)})</th>
                                    <th style="padding:8px 12px; text-align:right; min-width:160px; color:var(--color-brand);">本月新金额 (${escapeHtml(targetMonth)}) *</th>
                                    <th style="padding:8px 8px; text-align:center; width:36px;"></th>
                                </tr>
                            </thead>
                            <tbody id="template-items-body">
                                ${workingItems.map((item, idx) => {
                                    const origItem = initialItems[idx] || item;
                                    const lastAmtFormatted = formatCurrencyByCode(origItem.amount || 0, origItem.currency);
                                    return `
                                        <tr data-idx="${idx}">
                                            <td style="padding:8px 12px;">
                                                <div style="display:flex; flex-direction:column; gap:1px;">
                                                    <span style="font-weight:600; color:var(--text-primary);">${escapeHtml(item.platform)}</span>
                                                    <span style="font-size:11px; color:var(--text-secondary);">${escapeHtml(item.product)}</span>
                                                </div>
                                            </td>
                                            <td style="padding:8px 10px;">
                                                <span class="category-tag category-${item.category || 'bank'}" style="font-size:9.5px; padding:1px 5px;">${escapeHtml(item.category || 'bank')}</span>
                                            </td>
                                            <td style="padding:8px 10px; font-weight:500; font-size:11px;">
                                                ${escapeHtml(item.currency)}
                                            </td>
                                            <td style="padding:8px 10px; text-align:right; font-variant-numeric:tabular-nums; font-weight:600;">
                                                ${formatPercent(item.apr)}
                                            </td>
                                            <td style="padding:8px 12px; text-align:right; color:var(--text-placeholder); font-variant-numeric:tabular-nums;">
                                                ${lastAmtFormatted}
                                            </td>
                                            <td style="padding:6px 12px; text-align:right;">
                                                <div style="display:inline-flex; align-items:center; gap:4px; width:100%; max-width:160px; justify-content:flex-end;">
                                                    <span style="font-size:11px; color:var(--text-secondary); font-weight:600;">${item.currency}</span>
                                                    <input type="number" 
                                                           class="form-input template-amount-input" 
                                                           data-idx="${idx}" 
                                                           value="${item.amount}" 
                                                           step="any" 
                                                           min="0"
                                                           style="text-align:right; font-family:var(--font-mono); font-weight:700; width:110px; padding:5px 8px; font-size:13px;"
                                                           placeholder="0.00"
                                                           required>
                                                </div>
                                            </td>
                                            <td style="padding:6px 8px; text-align:center;">
                                                <button type="button" class="btn-remove-row" data-idx="${idx}" title="本月不再持有此标的（移除）" style="background:transparent; border:none; color:var(--text-placeholder); cursor:pointer; font-size:13px; padding:4px;">✕</button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Add Extra Product in Template Row -->
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <button type="button" id="btn-add-extra-holding" class="btn btn-secondary" style="font-size:11.5px; padding:5px 12px;">
                            + 本月新增其他标的 (Add New Holding)
                        </button>
                        <span style="font-size:11px; color:var(--text-placeholder);">
                            * 未填写的标的默认保持上次金额
                        </span>
                    </div>

                    <div id="template-error-banner" class="alert-banner alert-error" style="display:none; margin:0;">
                        <span id="template-error-text">Failed to save template.</span>
                    </div>
                </div>

                <div class="modal-footer" style="padding: 12px 20px; display:flex; justify-content:flex-end; gap:8px; border-top:1px solid var(--border-default);">
                    <button type="button" class="btn btn-secondary" id="btn-cancel">取消</button>
                    <button type="button" class="btn btn-primary" id="btn-submit-template" style="min-width:160px;">
                        <span id="btn-template-text">⚡ 保存并应用到 ${escapeHtml(targetMonth)}</span>
                        <span id="btn-template-spinner" class="spinner" style="display:none;"></span>
                    </button>
                </div>
            </div>
        `;

        bindEvents();
    }

    function updateLiveSummary() {
        const { totalMyr, totalAprMyr } = computeTotals();
        const summaryHost = backdrop.querySelector("#template-live-summary");
        if (summaryHost) {
            summaryHost.innerHTML = `
                <span>共 <strong>${workingItems.length}</strong> 项标的</span>
                <span style="color:var(--text-secondary);">|</span>
                <span>预计净值: <span style="color:var(--color-brand);">${formatMYR(totalMyr)}</span></span>
                <span style="color:var(--text-secondary);">|</span>
                <span>预估年收益: <span style="color:var(--color-profit);">${formatMYR(totalAprMyr)}</span></span>
            `;
        }
    }

    let releaseTrap = null;

    function closeModal() {
        if (typeof releaseTrap === 'function') releaseTrap();
        backdrop.classList.remove("open");
        setTimeout(() => backdrop.remove(), 160);
    }

    function bindEvents() {
        // Close modal handlers
        const closeBtn = backdrop.querySelector("#modal-close");
        const cancelBtn = backdrop.querySelector("#btn-cancel");
        if (closeBtn) closeBtn.addEventListener("click", closeModal);
        if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

        backdrop.addEventListener("click", (e) => {
            if (e.target === backdrop) closeModal();
        });

        // Keep last month amounts
        const btnKeep = backdrop.querySelector("#btn-keep-last");
        if (btnKeep) {
            btnKeep.addEventListener("click", () => {
                workingItems = initialItems.map(item => ({
                    platform: item.platform || 'Other',
                    product: item.product || 'Account',
                    category: item.category || 'bank',
                    currency: (item.currency || 'MYR').toUpperCase(),
                    amount: Math.max(0, Number(item.amount) || 0),
                    apr: Math.max(0, Number(item.apr) || 0)
                }));
                renderContent();
            });
        }

        // Clear all amounts to 0
        const btnClear = backdrop.querySelector("#btn-clear-all");
        if (btnClear) {
            btnClear.addEventListener("click", () => {
                workingItems.forEach(it => { it.amount = 0; });
                backdrop.querySelectorAll(".template-amount-input").forEach(input => {
                    input.value = "0";
                });
                updateLiveSummary();
            });
        }

        // Amount input listener for live calculation
        backdrop.querySelectorAll(".template-amount-input").forEach(input => {
            input.addEventListener("input", (e) => {
                const idx = parseInt(e.target.dataset.idx, 10);
                const val = Math.max(0, parseFloat(e.target.value) || 0);
                if (workingItems[idx]) {
                    workingItems[idx].amount = val;
                }
                updateLiveSummary();
            });

            // Auto-select text on focus for effortless overwriting
            input.addEventListener("focus", (e) => {
                e.target.select();
            });
        });

        // Remove row button
        backdrop.querySelectorAll(".btn-remove-row").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const idx = parseInt(e.currentTarget.dataset.idx, 10);
                if (!isNaN(idx) && idx >= 0 && idx < workingItems.length) {
                    workingItems.splice(idx, 1);
                    renderContent();
                }
            });
        });

        // Add extra holding in modal
        const btnAddExtra = backdrop.querySelector("#btn-add-extra-holding");
        if (btnAddExtra) {
            btnAddExtra.addEventListener("click", () => {
                const pName = prompt("请输入平台名称 (例如: Maybank, Luno, IBKR):");
                if (!pName || !pName.trim()) return;
                const prodName = prompt("请输入产品名称 (例如: Savings, Bitcoin, US Stocks):") || "Account";
                workingItems.push({
                    platform: pName.trim(),
                    product: prodName.trim(),
                    category: 'bank',
                    currency: 'MYR',
                    amount: 0,
                    apr: 0
                });
                renderContent();
            });
        }

        // Submit Button
        const submitBtn = backdrop.querySelector("#btn-submit-template");
        const btnText = backdrop.querySelector("#btn-template-text");
        const btnSpinner = backdrop.querySelector("#btn-template-spinner");
        const errBanner = backdrop.querySelector("#template-error-banner");
        const errText = backdrop.querySelector("#template-error-text");

        if (submitBtn) {
            submitBtn.addEventListener("click", async () => {
                if (workingItems.length === 0) {
                    alert("标的列表不能为空，请至少保留一项标的。");
                    return;
                }

                submitBtn.disabled = true;
                btnText.textContent = "正在保存...";
                btnSpinner.style.display = "inline-block";
                errBanner.style.display = "none";

                try {
                    // Sync any latest input values
                    backdrop.querySelectorAll(".template-amount-input").forEach(input => {
                        const idx = parseInt(input.dataset.idx, 10);
                        const val = Math.max(0, parseFloat(input.value) || 0);
                        if (workingItems[idx]) {
                            workingItems[idx].amount = val;
                        }
                    });

                    await WealthApi.inheritFromPreviousMonth(sourceMonth, targetMonth, workingItems);

                    closeModal();
                    if (typeof onSaved === 'function') {
                        onSaved();
                    }
                } catch (err) {
                    submitBtn.disabled = false;
                    btnText.textContent = `⚡ 保存并应用到 ${targetMonth}`;
                    btnSpinner.style.display = "none";
                    errText.textContent = err.message || "Failed to save template. Please try again.";
                    errBanner.style.display = "flex";
                }
            });
        }
    }

    renderContent();
    document.body.appendChild(backdrop);

    releaseTrap = trapFocus(backdrop, {
        returnFocusTo: triggerEl,
        onEscape: closeModal,
        initialFocus: ".template-amount-input"
    });
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[m]);
}
