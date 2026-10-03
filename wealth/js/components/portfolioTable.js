/**
 * wealth/js/components/portfolioTable.js
 * Multi-Platform Asset Portfolio Table with bidirectional multi-column sorting,
 * inline category filtering, real-time search, and asset CRUD management.
 */
import { formatMYR, formatCurrencyByCode, formatPercent } from '../core/math.js';
import { exportPortfolioToCSV } from '../core/export.js';

export function renderPortfolioTable(container, accounts = [], usdRate = 4.08, callbacks = {}) {
    if (!container) return;

    let activeCategory = "all";
    let searchQuery = "";
    let currentSortKey = "amount_myr";
    let currentSortDir = "desc";

    function getProcessedAccounts() {
        // 1. Filter by category and search text
        const filtered = accounts.filter(acc => {
            const matchesCategory = activeCategory === "all" || (acc.category || "bank") === activeCategory;
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = !q ||
                (acc.platform && acc.platform.toLowerCase().includes(q)) ||
                (acc.product && acc.product.toLowerCase().includes(q)) ||
                (acc.notes && acc.notes.toLowerCase().includes(q));
            return matchesCategory && matchesSearch;
        });

        // 2. Sort accounts
        if (!currentSortKey) return filtered;

        return [...filtered].sort((a, b) => {
            let valA = a[currentSortKey];
            let valB = b[currentSortKey];

            // Numeric comparison for amounts and rates
            if (['amount', 'amount_myr', 'apr', 'apr_amount_myr'].includes(currentSortKey)) {
                const numA = Number(valA) || 0;
                const numB = Number(valB) || 0;
                return currentSortDir === 'asc' ? numA - numB : numB - numA;
            }

            // String comparison for platform, product, category, notes
            valA = (valA ?? '').toString().toLowerCase();
            valB = (valB ?? '').toString().toLowerCase();
            const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
            return currentSortDir === 'asc' ? cmp : -cmp;
        });
    }

    function getSortIcon(colKey) {
        if (colKey !== currentSortKey) {
            // Unsorted subtle dual-arrow icon
            return `
                <svg class="sort-icon unsorted" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.35;">
                    <polyline points="7 15 12 20 17 15"></polyline>
                    <polyline points="7 9 12 4 17 9"></polyline>
                </svg>
            `;
        }
        if (currentSortDir === 'asc') {
            // Ascending (pointing up: low to high / A to Z)
            return `
                <svg class="sort-icon active-asc" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"></line>
                    <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
            `;
        }
        // Descending (pointing down: high to low / Z to A)
        return `
            <svg class="sort-icon active-desc" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
        `;
    }

    function renderSortTh(colKey, label, isRightAligned = false) {
        const isSorted = currentSortKey === colKey;
        const sortIcon = getSortIcon(colKey);
        const ariaSort = isSorted ? (currentSortDir === 'asc' ? 'ascending' : 'descending') : 'none';
        const isNumeric = ['amount', 'amount_myr', 'apr', 'apr_amount_myr'].includes(colKey);
        const nextDir = isSorted ? (currentSortDir === 'asc' ? 'descending' : 'ascending') : (isNumeric ? 'descending (high to low)' : 'ascending (A-Z)');
        const tooltip = `Sort by ${label} · Click to order ${nextDir}`;

        return `
            <th class="sortable-th ${isRightAligned ? 'text-right' : ''} ${isSorted ? 'is-sorted' : ''}" 
                data-sort="${colKey}" 
                role="columnheader" 
                aria-sort="${ariaSort}" 
                tabindex="0"
                title="${tooltip}">
                <div class="th-content ${isRightAligned ? 'justify-end' : ''}">
                    <span class="th-label">${label}</span>
                    <span class="sort-icon-box">${sortIcon}</span>
                </div>
            </th>
        `;
    }

    function render() {
        const processed = getProcessedAccounts();
        const currentMonth = callbacks.currentMonth || "";

        container.innerHTML = `
            <div class="portfolio-section">
                <!-- Section Header & Controls -->
                <div class="section-header">
                    <div class="section-title-group">
                        <h2 class="section-title">Asset Portfolio</h2>
                        <span class="section-count-tag tabular-nums">${processed.length} of ${accounts.length} Assets</span>
                        ${currentMonth ? `
                            <div class="table-month-control" title="Holdings month">
                                <button type="button" class="btn-table-month-step" id="tbl-btn-prev-month" title="Previous Month">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                </button>
                                <span class="table-month-badge tabular-nums">${currentMonth}</span>
                                <button type="button" class="btn-table-month-step" id="tbl-btn-next-month" title="Next Month">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                </button>
                            </div>
                        ` : ''}
                    </div>

                    <div class="section-filters-row">
                        <!-- Search Box -->
                        <div class="search-input-wrap">
                            <svg class="search-icon-svg" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <input type="text" id="table-search-input" class="table-search-input" placeholder="Search platform, product..." value="${escapeHtml(searchQuery)}">
                        </div>

                        <!-- Category Filters -->
                        <div class="category-filter-chips">
                            <button type="button" class="filter-chip ${activeCategory === 'all' ? 'active' : ''}" data-cat="all">All</button>
                            <button type="button" class="filter-chip ${activeCategory === 'bank' ? 'active' : ''}" data-cat="bank">Bank</button>
                            <button type="button" class="filter-chip ${activeCategory === 'cash' ? 'active' : ''}" data-cat="cash">Cash/E-Wallet</button>
                            <button type="button" class="filter-chip ${activeCategory === 'crypto' ? 'active' : ''}" data-cat="crypto">Crypto</button>
                            <button type="button" class="filter-chip ${activeCategory === 'investment' ? 'active' : ''}" data-cat="investment">Investment</button>
                            <button type="button" class="filter-chip ${activeCategory === 'trading' ? 'active' : ''}" data-cat="trading">Trading</button>
                        </div>

                        <!-- Actions -->
                        <div style="display:flex; gap:6px;">
                            <button type="button" id="btn-export-csv" class="btn btn-secondary" title="Export portfolio to CSV">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                Export
                            </button>
                            <button type="button" id="btn-add-asset" class="btn btn-primary">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Add Asset
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Table Content -->
                <div class="table-responsive-wrapper">
                    <table class="portfolio-table">
                        <thead>
                            <tr>
                                ${renderSortTh('platform', 'Platform')}
                                ${renderSortTh('product', 'Product')}
                                ${renderSortTh('category', 'Category')}
                                ${renderSortTh('amount', 'Original Amount', true)}
                                ${renderSortTh('amount_myr', 'Amount (MYR)', true)}
                                ${renderSortTh('apr', 'APR (%)', true)}
                                ${renderSortTh('apr_amount_myr', 'Est. Return (MYR)', true)}
                                <th class="row-actions-cell">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${processed.length === 0 ? `
                                <tr>
                                    <td colspan="8" class="table-empty-row">
                                        No assets found matching criteria. Click "+ Add Asset" to record a new holding.
                                    </td>
                                </tr>
                            ` : processed.map(acc => {
                                const origFormatted = formatCurrencyByCode(acc.amount, acc.currency);
                                const isAprHigh = acc.apr >= 5.0;

                                return `
                                    <tr data-id="${acc.id}">
                                        <td>
                                            <div class="platform-cell">
                                                <span class="platform-badge">${escapeHtml(acc.platform)}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span style="font-weight: 500;">${escapeHtml(acc.product)}</span>
                                        </td>
                                        <td>
                                            <span class="category-tag category-${acc.category || 'bank'}">${acc.category || 'bank'}</span>
                                        </td>
                                        <td class="text-right table-orig-amount">
                                            ${origFormatted} ${acc.currency !== 'MYR' ? `(${acc.currency})` : ''}
                                        </td>
                                        <td class="text-right table-amount-myr">
                                            ${formatMYR(acc.amount_myr)}
                                        </td>
                                        <td class="text-right">
                                            <span class="apr-tag ${isAprHigh ? 'apr-high' : ''}">${formatPercent(acc.apr)}</span>
                                        </td>
                                        <td class="text-right" style="color: var(--color-profit); font-weight: 600; font-variant-numeric: tabular-nums;">
                                            ${formatMYR(acc.apr_amount_myr)}
                                        </td>
                                        <td class="row-actions-cell">
                                            <button type="button" class="table-action-btn edit-asset-btn" data-id="${acc.id}" title="Edit asset">✎</button>
                                            <button type="button" class="table-action-btn delete-btn delete-asset-btn" data-id="${acc.id}" title="Delete asset">✕</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        bindEvents();
    }

    function bindEvents() {
        // Sortable column headers
        container.querySelectorAll(".sortable-th").forEach(th => {
            const handleSort = () => {
                const col = th.dataset.sort;
                if (!col) return;

                if (currentSortKey === col) {
                    // Invert direction
                    currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortKey = col;
                    // Default to desc for numeric metrics (highest first), asc for text
                    const isNumeric = ['amount', 'amount_myr', 'apr', 'apr_amount_myr'].includes(col);
                    currentSortDir = isNumeric ? 'desc' : 'asc';
                }
                render();
            };

            th.addEventListener("click", handleSort);
            th.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSort();
                }
            });
        });

        // Search input
        const searchInput = container.querySelector("#table-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                searchQuery = e.target.value;
                render();
                // Retain search input focus and cursor position across re-renders
                const newInp = container.querySelector("#table-search-input");
                if (newInp) {
                    newInp.focus();
                    newInp.selectionStart = newInp.selectionEnd = newInp.value.length;
                }
            });
        }

        // Category filter chips
        container.querySelectorAll(".filter-chip").forEach(chip => {
            chip.addEventListener("click", () => {
                activeCategory = chip.dataset.cat;
                render();
            });
        });

        // Add asset button
        const addBtn = container.querySelector("#btn-add-asset");
        if (addBtn && typeof callbacks.onAddAsset === 'function') {
            addBtn.addEventListener("click", callbacks.onAddAsset);
        }

        // Export CSV button
        const exportBtn = container.querySelector("#btn-export-csv");
        if (exportBtn) {
            exportBtn.addEventListener("click", () => {
                exportPortfolioToCSV(accounts, usdRate);
            });
        }

        // Edit buttons
        container.querySelectorAll(".edit-asset-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id;
                const acc = accounts.find(a => a.id === id);
                if (acc && typeof callbacks.onEditAsset === 'function') {
                    callbacks.onEditAsset(acc);
                }
            });
        });

        // Delete buttons
        container.querySelectorAll(".delete-asset-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.id;
                const acc = accounts.find(a => a.id === id);
                if (acc && typeof callbacks.onDeleteAsset === 'function') {
                    if (confirm(`Delete ${acc.platform} (${acc.product})?`)) {
                        callbacks.onDeleteAsset(id);
                    }
                }
            });
        });

        // Holdings table month steppers
        const prevTblBtn = container.querySelector("#tbl-btn-prev-month");
        if (prevTblBtn && currentMonth && typeof callbacks.onMonthChange === 'function') {
            prevTblBtn.addEventListener("click", () => {
                const [y, m] = currentMonth.split('-').map(Number);
                const d = new Date(y, m - 2, 1);
                const prevM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                callbacks.onMonthChange(prevM);
            });
        }

        const nextTblBtn = container.querySelector("#tbl-btn-next-month");
        if (nextTblBtn && currentMonth && typeof callbacks.onMonthChange === 'function') {
            nextTblBtn.addEventListener("click", () => {
                const [y, m] = currentMonth.split('-').map(Number);
                const d = new Date(y, m, 1);
                const nextM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                callbacks.onMonthChange(nextM);
            });
        }
    }

    render();
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
