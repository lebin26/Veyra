/**
 * wealth/js/core/api.js
 * Month-Centric High-Availability API & Offline Store
 * Designed for monthly entries with automatic historical archiving.
 */

const SEED_OCT_2026 = [
    { id: "acc_1", platform: "Touch 'n Go", product: "GO+", category: "cash", currency: "MYR", amount: 405.37, apr: 3.11, notes: "Daily cash yield" },
    { id: "acc_2", platform: "Hong Leong Bank", product: "Saving", category: "bank", currency: "MYR", amount: 3284.19, apr: 1.50, notes: "Emergency fund" },
    { id: "acc_3", platform: "Hong Leong Bank", product: "e-FD", category: "bank", currency: "MYR", amount: 3000.00, apr: 3.60, notes: "Fixed Deposit" },
    { id: "acc_4", platform: "Public Bank", product: "Saving", category: "bank", currency: "MYR", amount: 0.00, apr: 0.00, notes: "" },
    { id: "acc_5", platform: "myASNB", product: "ASM1", category: "investment", currency: "MYR", amount: 65.93, apr: 5.00, notes: "Government unit trust" },
    { id: "acc_6", platform: "myASNB", product: "ASM2", category: "investment", currency: "MYR", amount: 0.00, apr: 5.00, notes: "" },
    { id: "acc_7", platform: "myASNB", product: "ASM3", category: "investment", currency: "MYR", amount: 105.50, apr: 5.00, notes: "" },
    { id: "acc_8", platform: "Rize", product: "Saving", category: "bank", currency: "MYR", amount: 491.47, apr: 0.00, notes: "Digital bank" },
    { id: "acc_9", platform: "Versa", product: "Cash", category: "cash", currency: "MYR", amount: 4026.59, apr: 3.48, notes: "MMF Liquid Cash" },
    { id: "acc_10", platform: "Aeon Wallet", product: "Saving", category: "cash", currency: "MYR", amount: 15.00, apr: 0.00, notes: "" },
    { id: "acc_11", platform: "Shopee Pay", product: "Money+", category: "cash", currency: "MYR", amount: 1029.02, apr: 5.61, notes: "High APR Wallet" },
    { id: "acc_12", platform: "Ryt Bank", product: "Saving", category: "bank", currency: "MYR", amount: 295.54, apr: 2.05, notes: "" },
    { id: "acc_13", platform: "Seter", product: "Saving", category: "bank", currency: "MYR", amount: 9.62, apr: 0.00, notes: "" },
    { id: "acc_14", platform: "Bybit", product: "Mantle Vault", category: "crypto", currency: "USD", amount: 400.00, apr: 6.75, notes: "On-chain Staking" },
    { id: "acc_15", platform: "Bybit", product: "Flexible", category: "crypto", currency: "USD", amount: 200.00, apr: 7.18, notes: "USDT Flexible Earn" },
    { id: "acc_16", platform: "Bybit", product: "BYUSDT", category: "crypto", currency: "USD", amount: 421.36, apr: 3.18, notes: "Trading Collateral" },
    { id: "acc_17", platform: "VT Markets", product: "Trading Account", category: "trading", currency: "USD", amount: 61.42, apr: 0.00, notes: "Forex Broker" },
    { id: "acc_18", platform: "Vantage", product: "Trading Account", category: "trading", currency: "USD", amount: 0.34, apr: 0.00, notes: "CFD Account" }
];

const SEED_SEP_2026 = [
    { id: "acc_s1", platform: "Touch 'n Go", product: "GO+", category: "cash", currency: "MYR", amount: 350.00, apr: 3.11, notes: "" },
    { id: "acc_s2", platform: "Hong Leong Bank", product: "Saving", category: "bank", currency: "MYR", amount: 2800.00, apr: 1.50, notes: "" },
    { id: "acc_s3", platform: "Hong Leong Bank", product: "e-FD", category: "bank", currency: "MYR", amount: 3000.00, apr: 3.60, notes: "" },
    { id: "acc_s9", platform: "Versa", product: "Cash", category: "cash", currency: "MYR", amount: 3800.00, apr: 3.48, notes: "" },
    { id: "acc_s11", platform: "Shopee Pay", product: "Money+", category: "cash", currency: "MYR", amount: 950.00, apr: 5.61, notes: "" },
    { id: "acc_s14", platform: "Bybit", product: "Mantle Vault", category: "crypto", currency: "USD", amount: 400.00, apr: 6.75, notes: "" },
    { id: "acc_s15", platform: "Bybit", product: "Flexible", category: "crypto", currency: "USD", amount: 150.00, apr: 7.18, notes: "" },
    { id: "acc_s16", platform: "Bybit", product: "BYUSDT", category: "crypto", currency: "USD", amount: 410.00, apr: 3.18, notes: "" }
];

function getAuthHeader() {
    let token = null;
    try { token = localStorage.getItem("veyra_session_token"); } catch (_) {}
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

// Local monthly storage helpers
function getMonthlyStore() {
    try {
        const val = localStorage.getItem("veyra_wealth_monthly_store");
        if (val) return JSON.parse(val);
    } catch (_) {}

    // Initialize with Sep 2026 (Archived) and Oct 2026 (Active)
    const initial = {
        "2026-09": {
            month: "2026-09",
            usd_rate: 4.08,
            items: SEED_SEP_2026,
            is_archived: true
        },
        "2026-10": {
            month: "2026-10",
            usd_rate: 4.08,
            items: SEED_OCT_2026,
            is_archived: false
        }
    };
    saveMonthlyStore(initial);
    return initial;
}

function saveMonthlyStore(store) {
    try {
        localStorage.setItem("veyra_wealth_monthly_store", JSON.stringify(store));
    } catch (_) {}
}

function computeLocalMonthlySummary(month) {
    const store = getMonthlyStore();
    const usdRate = Number(localStorage.getItem("veyra_wealth_usd_rate") || 4.08);

    const monthData = store[month] || null;
    const accountsRaw = monthData ? monthData.items : [];

    let totalNetWorthMyr = 0;
    let totalEstimatedAprMyr = 0;
    const categoryMap = {};
    const platformMap = {};

    const computedAccounts = accountsRaw.map(a => {
        const amt = Number(a.amount) || 0;
        const apr = Number(a.apr) || 0;
        const rate = a.currency === 'USD' ? usdRate : 1.0;
        const myr = Math.round(amt * rate * 100) / 100;
        const aprAmt = Math.round(((myr * apr) / 100) * 100) / 100;

        totalNetWorthMyr += myr;
        totalEstimatedAprMyr += aprAmt;

        const cat = a.category || 'bank';
        categoryMap[cat] = (categoryMap[cat] || 0) + myr;
        const plat = a.platform || 'Other';
        platformMap[plat] = (platformMap[plat] || 0) + myr;

        return {
            ...a,
            amount: amt,
            apr,
            amount_myr: myr,
            apr_amount_myr: aprAmt
        };
    });

    totalNetWorthMyr = Math.round(totalNetWorthMyr * 100) / 100;
    totalEstimatedAprMyr = Math.round(totalEstimatedAprMyr * 100) / 100;
    const weightedRoi = totalNetWorthMyr > 0 ? Math.round(((totalEstimatedAprMyr / totalNetWorthMyr) * 100) * 100) / 100 : 0;

    // All available recorded months
    const availableMonths = Object.keys(store).sort();

    // Previous month comparison
    const prevMonths = availableMonths.filter(m => m < month);
    const prevMonthKey = prevMonths[prevMonths.length - 1] || null;
    let deltaRm = 0;
    let growthRate = 0;
    let prevNetWorth = 0;

    if (prevMonthKey && store[prevMonthKey]) {
        const prevSummary = computeLocalMonthlySummary(prevMonthKey);
        prevNetWorth = prevSummary.portfolio.total_net_worth_myr;
        if (prevNetWorth > 0 && totalNetWorthMyr > 0) {
            deltaRm = Math.round((totalNetWorthMyr - prevNetWorth) * 100) / 100;
            growthRate = Math.round(((deltaRm / prevNetWorth) * 100) * 100) / 100;
        }
    }

    // Historical snapshots for chart
    const historySnapshots = availableMonths.map(m => {
        if (m === month) {
            return {
                month: m,
                total_net_worth_myr: totalNetWorthMyr,
                estimated_apr_myr: totalEstimatedAprMyr,
                weighted_roi: weightedRoi
            };
        }
        const s = store[m];
        let nW = 0; let aprSum = 0;
        (s.items || []).forEach(it => {
            const r = it.currency === 'USD' ? (s.usd_rate || usdRate) : 1.0;
            const mVal = (it.amount || 0) * r;
            nW += mVal;
            aprSum += (mVal * (it.apr || 0)) / 100;
        });
        return {
            month: m,
            total_net_worth_myr: Math.round(nW * 100) / 100,
            estimated_apr_myr: Math.round(aprSum * 100) / 100,
            weighted_roi: nW > 0 ? Math.round(((aprSum / nW) * 100) * 100) / 100 : 0
        };
    });

    const categoryBreakdown = Object.entries(categoryMap).map(([cat, val]) => ({
        category: cat,
        amount_myr: val,
        percentage: totalNetWorthMyr > 0 ? Math.round(((val / totalNetWorthMyr) * 100) * 10) / 10 : 0
    })).sort((a,b) => b.amount_myr - a.amount_myr);

    const platformBreakdown = Object.entries(platformMap).map(([plat, val]) => ({
        platform: plat,
        amount_myr: val,
        percentage: totalNetWorthMyr > 0 ? Math.round(((val / totalNetWorthMyr) * 100) * 10) / 10 : 0
    })).sort((a,b) => b.amount_myr - a.amount_myr);

    const topApr = [...computedAccounts].filter(a => a.apr > 0 && a.amount_myr > 0).sort((a,b) => b.apr - a.apr).slice(0, 4);

    return {
        month,
        is_archived: monthData ? !!monthData.is_archived : false,
        needs_init: accountsRaw.length === 0,
        usd_rate: usdRate,
        available_months: availableMonths,
        last_recorded_month: prevMonthKey,
        portfolio: {
            total_net_worth_myr: totalNetWorthMyr,
            estimated_apr_myr: totalEstimatedAprMyr,
            weighted_roi: weightedRoi,
            accounts_count: computedAccounts.length,
            accounts: computedAccounts
        },
        growth: {
            delta_rm: deltaRm,
            growth_rate: growthRate,
            previous_month: prevMonthKey,
            previous_net_worth: prevNetWorth
        },
        analytics: {
            category_breakdown: categoryBreakdown,
            platform_breakdown: platformBreakdown,
            history_snapshots: historySnapshots
        },
        insights: {
            top_apr_contributors: topApr
        }
    };
}

async function request(url, options = {}) {
    const defaultHeaders = getAuthHeader();
    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...(options.headers || {})
        }
    };

    try {
        const res = await fetch(url, config);
        if (res.status === 401) return { unauthorized: true };
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (_) {
        return null;
    }
}

export const WealthApi = {
    async getSummary(month) {
        const m = month || "2026-10";
        const remote = await request(`/api/wealth/summary?month=${encodeURIComponent(m)}`);
        if (remote && !remote.unauthorized && remote.portfolio?.accounts?.length) {
            return remote;
        }
        if (remote?.unauthorized) return { unauthorized: true };

        return computeLocalMonthlySummary(m);
    },

    async getPortfolio(month) {
        const m = month || "2026-10";
        const remote = await request(`/api/wealth/portfolio?month=${encodeURIComponent(m)}`);
        if (remote && remote.accounts) return remote;

        const store = getMonthlyStore();
        return {
            month: m,
            accounts: store[m]?.items || [],
            usd_rate: Number(localStorage.getItem("veyra_wealth_usd_rate") || 4.08)
        };
    },

    async createAccount(payload, month) {
        const m = month || "2026-10";
        const remote = await request(`/api/wealth/portfolio?month=${encodeURIComponent(m)}`, {
            method: "POST",
            body: JSON.stringify({ ...payload, month: m })
        });
        if (remote && remote.success) return remote;

        const store = getMonthlyStore();
        if (!store[m]) {
            store[m] = { month: m, usd_rate: 4.08, items: [], is_archived: false };
        }
        const newAcc = {
            id: 'acc_' + Date.now().toString(36),
            ...payload,
            amount: Number(payload.amount) || 0,
            apr: Number(payload.apr) || 0
        };
        store[m].items.push(newAcc);
        saveMonthlyStore(store);
        return { success: true, account: newAcc };
    },

    async updateAccount(id, payload, month) {
        const m = month || "2026-10";
        const remote = await request(`/api/wealth/portfolio/${encodeURIComponent(id)}?month=${encodeURIComponent(m)}`, {
            method: "PUT",
            body: JSON.stringify(payload)
        });
        if (remote && remote.success) return remote;

        const store = getMonthlyStore();
        if (store[m]) {
            const idx = store[m].items.findIndex(a => a.id === id);
            if (idx !== -1) {
                store[m].items[idx] = { ...store[m].items[idx], ...payload };
                saveMonthlyStore(store);
            }
        }
        return { success: true, id };
    },

    async deleteAccount(id, month) {
        const m = month || "2026-10";
        const remote = await request(`/api/wealth/portfolio/${encodeURIComponent(id)}?month=${encodeURIComponent(m)}`, {
            method: "DELETE"
        });
        if (remote && remote.success) return remote;

        const store = getMonthlyStore();
        if (store[m]) {
            store[m].items = store[m].items.filter(a => a.id !== id);
            saveMonthlyStore(store);
        }
        return { success: true, deleted: true };
    },

    // 一键从上月复制数据到新月份并归档旧月
    async inheritFromPreviousMonth(sourceMonth, targetMonth) {
        const remote = await request("/api/wealth/snapshots", {
            method: "POST",
            body: JSON.stringify({
                action: "clone",
                source_month: sourceMonth,
                target_month: targetMonth,
                usd_rate: Number(localStorage.getItem("veyra_wealth_usd_rate") || 4.08)
            })
        });
        if (remote && remote.success) return remote;

        const store = getMonthlyStore();
        if (!store[sourceMonth]) {
            throw new Error(`Previous month ${sourceMonth} not found`);
        }

        // Archive source month
        store[sourceMonth].is_archived = true;

        // Clone items into target month
        const clonedItems = store[sourceMonth].items.map(it => ({
            ...it,
            id: 'acc_' + Math.random().toString(36).substring(2, 9)
        }));

        store[targetMonth] = {
            month: targetMonth,
            usd_rate: store[sourceMonth].usd_rate || 4.08,
            items: clonedItems,
            is_archived: false
        };

        saveMonthlyStore(store);
        return { success: true, month: targetMonth, count: clonedItems.length };
    },

    async deleteMonth(month) {
        await request(`/api/wealth/snapshots?month=${encodeURIComponent(month)}`, { method: "DELETE" });
        const store = getMonthlyStore();
        if (store[month]) {
            delete store[month];
            saveMonthlyStore(store);
        }
        return { success: true };
    },


    async saveSettings(payload) {
        if (payload.default_usd_rate) {
            localStorage.setItem("veyra_wealth_usd_rate", payload.default_usd_rate);
        }
        await request("/api/wealth/settings", { method: "PUT", body: JSON.stringify(payload) });
        return { success: true, settings: payload };
    }
};
