/**
 * wealth/js/core/math.js
 * Financial math and string formatters with zero jitter
 */

const currencyFormatterMYR = new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const currencyFormatterUSD = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

export function formatMYR(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return 'RM 0.00';
    return currencyFormatterMYR.format(amount).replace('MYR', 'RM');
}

export function formatUSD(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
    return currencyFormatterUSD.format(amount);
}

export function formatCurrencyByCode(amount, code = 'MYR') {
    if (code === 'USD') return formatUSD(amount);
    return formatMYR(amount);
}

export function formatPercent(val) {
    if (val === undefined || val === null || isNaN(val)) return '0.00%';
    return `${Number(val).toFixed(2)}%`;
}

export function formatNumber(val) {
    if (val === undefined || val === null || isNaN(val)) return '0.00';
    return numberFormatter.format(val);
}

export function getCurrentMonthStr() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

export function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
