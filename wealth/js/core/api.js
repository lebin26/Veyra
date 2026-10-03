/**
 * wealth/js/core/api.js
 * Month-Centric High-Availability API & Offline Store
 * Strictly partitioned by user ID to guarantee zero multi-tenant data bleed.
 */

function getActiveUserId() {
    try {
        return localStorage.getItem("veyra_active_user_id") || "guest";
    } catch (_) {
        return "guest";
    }
}

function getScopedKey(baseKey) {
    const uid = getActiveUserId().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${baseKey}_${uid}`;
}

function getAuthHeader() {
    let token = null;
    try { token = localStorage.getItem("veyra_session_token"); } catch (_) {}
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

function getScopedUsdRate() {
    try {
        const rate = localStorage.getItem(getScopedKey("veyra_wealth_usd_rate"));
        return rate ? Number(rate) : 4.08;
    } catch (_) {
        return 4.08;
    }
}

function setScopedUsdRate(rate) {
    try {
        localStorage.setItem(getScopedKey("veyra_wealth_usd_rate"), String(rate));
    } catch (_) {}
}

// Local monthly storage helpers (isolated per authenticated user)
function getMonthlyStore() {
    const key = getScopedKey("veyra_wealth_monthly_store");
    try {
        const val = localStorage.getItem(key);
        if (val) return JSON.parse(val);
    } catch (_) {}

    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const initial = {
        [curMonth]: {
            month: curMonth,
            usd_rate: getScopedUsdRate(),
            items: [],
            is_archived: false
        }
    };
    saveMonthlyStore(initial);
    return initial;
}

function saveMonthlyStore(store) {
    const key = getScopedKey("veyra_wealth_monthly_store");
    try {
        localStorage.setItem(key, JSON.stringify(store));
    } catch (_) {}
}

function computeLocalMonthlySummary(month) {
    const store = getMonthlyStore();
    const usdRate = getScopedUsdRate();

    const monthData = store[month] || null;
    const accountsRaw = monthData ? (monthData.items || []) : [];

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
        prevNetWorth = prevSummary.portfolio?.total_net_worth_myr || 0;
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
        (s?.items || []).forEach(it => {
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
        
        // If remote responded successfully, it reflects this user's cloud state (even if 0 accounts)
        if (remote && !remote.unauthorized && remote.portfolio) {
            const store = getMonthlyStore();
            store[m] = {
                month: m,
                usd_rate: remote.usd_rate || getScopedUsdRate(),
                items: remote.portfolio.accounts || [],
                is_archived: !!remote.is_archived
            };
            saveMonthlyStore(store);
            if (remote.usd_rate) setScopedUsdRate(remote.usd_rate);
            return remote;
        }
        if (remote?.unauthorized) return { unauthorized: true };

        // Fallback to user's isolated local store if offline
        return computeLocalMonthlySummary(m);
    },

    async getPortfolio(month) {
        const m = month || "2026-10";
        const remote = await request(`/api/wealth/portfolio?month=${encodeURIComponent(m)}`);
        if (remote && remote.accounts) {
            const store = getMonthlyStore();
            store[m] = {
                month: m,
                usd_rate: remote.usd_rate || getScopedUsdRate(),
                items: remote.accounts,
                is_archived: false
            };
            saveMonthlyStore(store);
            if (remote.usd_rate) setScopedUsdRate(remote.usd_rate);
            return remote;
        }

        const store = getMonthlyStore();
        return {
            month: m,
            accounts: store[m]?.items || [],
            usd_rate: getScopedUsdRate()
        };
    },

    async createAccount(payload, month) {
        const m = month || "2026-10";
        const remote = await request(`/api/wealth/portfolio?month=${encodeURIComponent(m)}`, {
            method: "POST",
            body: JSON.stringify({ ...payload, month: m })
        });
        
        const store = getMonthlyStore();
        if (!store[m]) {
            store[m] = { month: m, usd_rate: getScopedUsdRate(), items: [], is_archived: false };
        }
        const newAcc = (remote && remote.account) ? remote.account : {
            id: 'acc_' + Date.now().toString(36),
            ...payload,
            amount: Number(payload.amount) || 0,
            apr: Number(payload.apr) || 0
        };
        store[m].items.push(newAcc);
        saveMonthlyStore(store);

        return remote || { success: true, account: newAcc };
    },

    async updateAccount(id, payload, month) {
        const m = month || "2026-10";
        const remote = await request(`/api/wealth/portfolio/${encodeURIComponent(id)}?month=${encodeURIComponent(m)}`, {
            method: "PUT",
            body: JSON.stringify(payload)
        });

        const store = getMonthlyStore();
        if (store[m]) {
            const idx = store[m].items.findIndex(a => a.id === id);
            if (idx !== -1) {
                store[m].items[idx] = { ...store[m].items[idx], ...payload };
                saveMonthlyStore(store);
            }
        }
        return remote || { success: true, id };
    },

    async deleteAccount(id, month) {
        const m = month || "2026-10";
        const remote = await request(`/api/wealth/portfolio/${encodeURIComponent(id)}?month=${encodeURIComponent(m)}`, {
            method: "DELETE"
        });

        const store = getMonthlyStore();
        if (store[m]) {
            store[m].items = store[m].items.filter(a => a.id !== id);
            saveMonthlyStore(store);
        }
        return remote || { success: true, deleted: true };
    },

    // 一键从上月复制数据到新月份并归档旧月
    async inheritFromPreviousMonth(sourceMonth, targetMonth) {
        const remote = await request("/api/wealth/snapshots", {
            method: "POST",
            body: JSON.stringify({
                action: "clone",
                source_month: sourceMonth,
                target_month: targetMonth,
                usd_rate: getScopedUsdRate()
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
            usd_rate: store[sourceMonth].usd_rate || getScopedUsdRate(),
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
            setScopedUsdRate(payload.default_usd_rate);
        }
        await request("/api/wealth/settings", { method: "PUT", body: JSON.stringify(payload) });
        return { success: true, settings: payload };
    }
};
