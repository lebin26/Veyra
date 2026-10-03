/**
 * wealth/js/app.js
 * Wealth Tracker Master Application Controller
 * Month-Centric Architecture with 12-Month Calendar & Archive Grid Management
 * Veyra Trading Platform
 */
import { getCurrentUserAndProfile, signOut } from '../../js/auth/authState.js?v=4';
import { getCurrentMonthStr } from './core/math.js';
import { WealthApi } from './core/api.js';
import { renderKPICards } from './components/kpiCards.js';
import { renderHealthDiagnostic } from './components/healthDiagnostic.js';
import { renderPortfolioTable } from './components/portfolioTable.js';
import { renderChartEngine } from './components/chartEngine.js';
import { renderMonthCalendar } from './components/monthCalendar.js';
import { openAssetModal } from './components/assetModal.js';
import { openSnapshotModal } from './components/snapshotModal.js';
import { openRateModal } from './components/rateModal.js';

document.addEventListener("DOMContentLoaded", async () => {
    const realCurrentMonth = getCurrentMonthStr(); // Real-world current month
    let currentMonth = realCurrentMonth;
    let activeViewMode = "dashboard"; // "dashboard" | "portfolio" | "calendar"
    let currentData = null;
    let currentUserProfile = null;

    const elements = {
        themeToggleBtn: document.getElementById("theme-toggle-btn"),
        authStatusContainer: document.getElementById("auth-status-container"),
        headerRatePill: document.getElementById("header-rate-pill"),
        headerRateVal: document.getElementById("header-rate-val"),
        headerViewingMonth: document.getElementById("header-viewing-month"),
        headerMonthPicker: document.getElementById("header-month-picker"),
        monthDropdownSelect: document.getElementById("month-dropdown-select"),
        btnPrevMonth: document.getElementById("btn-prev-month"),
        btnNextMonth: document.getElementById("btn-next-month"),
        btnJumpCurrentMonth: document.getElementById("btn-jump-current-month"),
        monthStatusBadge: document.getElementById("month-status-badge"),
        btnNewMonth: document.getElementById("btn-new-month"),
        btnTakeSnapshot: document.getElementById("btn-take-snapshot"),
        pageTitle: document.getElementById("page-current-title"),
        sidebarCurrentMonth: document.getElementById("sidebar-current-month"),
        viewDashboard: document.getElementById("view-dashboard"),
        viewPortfolio: document.getElementById("view-portfolio"),
        viewCalendar: document.getElementById("view-calendar"),
        btnJumpToPortfolio: document.getElementById("btn-jump-to-portfolio"),
        calendarContainer: document.getElementById("calendar-container"),
        monthInitBanner: document.getElementById("month-init-banner"),
        kpiContainer: document.getElementById("kpi-container"),
        diagnosticContainer: document.getElementById("diagnostic-container"),
        chartsContainer: document.getElementById("charts-container"),
        portfolioContainer: document.getElementById("portfolio-container"),
        toast: document.getElementById("wealth-toast"),
        softLockHost: document.getElementById("soft-lock-host")
    };

    // ──────────────────────────────────────────
    // 1. Theme Engine (Calibrated to Veyra)
    // ──────────────────────────────────────────
    const SVG_MOON = `<svg class="theme-icon-svg" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    const SVG_SUN = `<svg class="theme-icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;

    function applyTheme(theme) {
        if (theme === "dark") {
            document.documentElement.setAttribute("data-theme", "dark");
            if (elements.themeToggleBtn) {
                elements.themeToggleBtn.innerHTML = SVG_SUN;
                elements.themeToggleBtn.setAttribute("title", "Switch to light theme (T)");
                elements.themeToggleBtn.setAttribute("aria-label", "Switch to light theme");
            }
        } else {
            document.documentElement.removeAttribute("data-theme");
            if (elements.themeToggleBtn) {
                elements.themeToggleBtn.innerHTML = SVG_MOON;
                elements.themeToggleBtn.setAttribute("title", "Switch to dark theme (T)");
                elements.themeToggleBtn.setAttribute("aria-label", "Switch to dark theme");
            }
        }
        try { localStorage.setItem("calc_theme", theme); } catch (_) {}
    }

    function toggleTheme() {
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        applyTheme(isDark ? "light" : "dark");
    }

    if (elements.themeToggleBtn) {
        elements.themeToggleBtn.addEventListener("click", toggleTheme);
    }

    try {
        const savedTheme = localStorage.getItem("calc_theme");
        if (savedTheme) applyTheme(savedTheme);
        else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) applyTheme("dark");
        else applyTheme("light");
    } catch (_) {
        applyTheme("light");
    }

    // ──────────────────────────────────────────
    // 2. Toast Notifications
    // ──────────────────────────────────────────
    let toastTimer = null;
    function showToast(msg) {
        if (!elements.toast) return;
        elements.toast.textContent = msg;
        elements.toast.classList.add("visible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2500);
    }

    // ──────────────────────────────────────────
    // 3. Month Stepper Math
    // ──────────────────────────────────────────
    function offsetMonth(monthStr, offset) {
        const [y, m] = monthStr.split('-').map(Number);
        const d = new Date(y, m - 1 + offset, 1);
        const nextY = d.getFullYear();
        const nextM = String(d.getMonth() + 1).padStart(2, '0');
        return `${nextY}-${nextM}`;
    }

    // ──────────────────────────────────────────
    // 4. Auth & Soft Lock System
    // ──────────────────────────────────────────
    async function checkAuthAndEntitlements() {
        try {
            const { user, profile } = await getCurrentUserAndProfile();
            currentUserProfile = profile;

            if (user && profile && profile.status === "active") {
                try { localStorage.setItem("veyra_active_user_id", user.id); } catch (_) {}
                const isRevoked = profile.app_overrides?.wealth_tracker === false;
                if (isRevoked) {
                    showSoftLock("Access Restricted", "Access to Wealth Tracker has been restricted for your account by an administrator.");
                    return false;
                }

                const initial = (profile.display_name || profile.username || profile.email || "U").charAt(0).toUpperCase();
                const isAdmin = profile.role === "admin";
                elements.authStatusContainer.innerHTML = `
                    <div class="user-badge-pill">
                        <span class="user-avatar-dot">${initial}</span>
                        <span class="user-name-text">${profile.display_name || profile.username}</span>
                        ${isAdmin ? `<span class="user-role-tag" style="font-size:10px; font-weight:700; color:var(--color-brand); background:rgba(47,91,255,0.1); padding:1px 6px; border-radius:999px;">ADMIN</span>` : ''}
                        <button type="button" id="btn-header-signout" class="btn-header-signout" title="Sign out">Sign out</button>
                    </div>
                `;

                const signoutBtn = document.getElementById("btn-header-signout");
                if (signoutBtn) {
                    signoutBtn.addEventListener("click", async () => {
                        await signOut();
                        window.location.reload();
                    });
                }
                return true;
            } else {
                showSoftLock("Members Only", "Sign in with your Veyra Trading account to access the Wealth Tracker portfolio system.");
                return false;
            }
        } catch (_) {
            showSoftLock("Members Only", "Sign in with your Veyra Trading account to access the Wealth Tracker portfolio system.");
            return false;
        }
    }

    function showSoftLock(title, desc) {
        if (!elements.softLockHost) return;
        elements.softLockHost.innerHTML = `
            <div class="soft-lock-curtain">
                <div class="soft-lock-card">
                    <div class="soft-lock-icon-wrap">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </div>
                    <h2 class="soft-lock-title">${title}</h2>
                    <p class="soft-lock-desc">${desc}</p>
                    <div style="display:flex; gap:10px; width:100%;">
                        <a href="../main-page/index.html" class="btn btn-secondary" style="flex:1; justify-content:center;">Back to Apps</a>
                        <a href="../auth/login.html" class="btn btn-primary" style="flex:1; justify-content:center;">Sign In</a>
                    </div>
                </div>
            </div>
        `;
    }

    // ──────────────────────────────────────────
    // 5. Month-Centric View Orchestration
    // ──────────────────────────────────────────
    async function loadData() {
        try {
            const data = await WealthApi.getSummary(currentMonth);
            if (data.unauthorized) {
                showSoftLock("Members Only", "Sign in with your Veyra Trading account to access the Wealth Tracker portfolio system.");
                return;
            }

            currentData = data;
            const usdRate = data.usd_rate || 4.08;

            // Sync Header USD/MYR rate
            if (elements.headerRateVal) {
                elements.headerRateVal.textContent = Number(usdRate).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
            }

            // Sync Viewing Month text, picker input, dropdown, sidebar month pill, and status badge
            if (elements.headerViewingMonth) {
                elements.headerViewingMonth.textContent = currentMonth;
            }
            if (elements.headerMonthPicker) {
                elements.headerMonthPicker.value = currentMonth;
            }
            if (elements.sidebarCurrentMonth) {
                elements.sidebarCurrentMonth.textContent = currentMonth;
            }

            if (elements.monthDropdownSelect) {
                const history = data.analytics?.history_snapshots || [];
                const monthsSet = new Set(history.map(h => h.month));
                monthsSet.add(realCurrentMonth);
                monthsSet.add(currentMonth);
                const sortedMonths = Array.from(monthsSet).sort().reverse();

                elements.monthDropdownSelect.innerHTML = sortedMonths.map(m => {
                    const isReal = m === realCurrentMonth;
                    const isCur = m === currentMonth;
                    const isArch = history.find(h => h.month === m);
                    const tag = isReal ? ' (本月)' : (isArch ? ' (归档)' : '');
                    return `<option value="${m}" ${isCur ? 'selected' : ''}>${m}${tag}</option>`;
                }).join("");
            }

            if (elements.monthStatusBadge) {
                const isRealCurrent = currentMonth === realCurrentMonth;
                if (data.is_archived) {
                    elements.monthStatusBadge.textContent = "📦 Archived Month";
                    elements.monthStatusBadge.style.color = "var(--text-secondary)";
                    elements.monthStatusBadge.style.background = "var(--fill-subtle)";
                } else if (isRealCurrent) {
                    elements.monthStatusBadge.textContent = "★ Current Month";
                    elements.monthStatusBadge.style.color = "var(--color-brand)";
                    elements.monthStatusBadge.style.background = "rgba(47, 91, 255, 0.1)";
                } else {
                    elements.monthStatusBadge.textContent = "● Active Month";
                    elements.monthStatusBadge.style.color = "var(--color-profit)";
                    elements.monthStatusBadge.style.background = "var(--color-profit-bg)";
                }
            }

            // Update 12-Month Calendar Component
            renderMonthCalendar(elements.calendarContainer, {
                activeMonth: currentMonth,
                realCurrentMonth: realCurrentMonth,
                historySnapshots: data.analytics?.history_snapshots || [],
                onSelectMonth: (m) => {
                    currentMonth = m;
                    // If currently on calendar, transition to portfolio (holdings) to see assets
                    if (activeViewMode === "calendar") {
                        switchViewMode("portfolio");
                    }
                    loadData();
                },
                onDeleteMonth: async (m) => {
                    try {
                        await WealthApi.deleteMonth(m);
                        showToast(`Deleted archive for ${m}`);
                        // If deleted current month, shift to previous or default
                        if (currentMonth === m) {
                            currentMonth = offsetMonth(m, -1);
                        }
                        loadData();
                    } catch (err) {
                        alert(err.message || "Failed to delete month");
                    }
                },
                onInitMonth: (m) => {
                    currentMonth = m;
                    if (activeViewMode === "calendar") {
                        switchViewMode("portfolio");
                    }
                    loadData();
                }
            });

            // Check if month needs initialization (empty record)
            if (data.needs_init) {
                renderMonthInitBanner(data.last_recorded_month);
            } else {
                if (elements.monthInitBanner) {
                    elements.monthInitBanner.style.display = "none";
                    elements.monthInitBanner.innerHTML = "";
                }
            }

            // 1. Render KPI Cards
            renderKPICards(elements.kpiContainer, data, () => {
                openRateModal(usdRate, () => {
                    showToast("FX rate updated");
                    loadData();
                });
            });

            // 2. Render Health Diagnostic Banner
            renderHealthDiagnostic(elements.diagnosticContainer, data);

            // 3. Render Visual Charts
            renderChartEngine(elements.chartsContainer, {
                ...data.analytics,
                accounts: data.portfolio?.accounts || [],
                portfolio: data.portfolio,
                growth: data.growth
            });

            // 4. Render Asset Portfolio Table
            renderPortfolioTable(elements.portfolioContainer, data.portfolio?.accounts || [], usdRate, {
                currentMonth: currentMonth,
                isArchived: !!data.is_archived,
                onMonthChange: (m) => {
                    currentMonth = m;
                    showToast(`Switched Holdings to ${m}`);
                    loadData();
                },
                onAddAsset: () => {
                    openAssetModal(null, () => {
                        showToast("Asset added to " + currentMonth);
                        loadData();
                    });
                },
                onEditAsset: (asset) => {
                    openAssetModal(asset, () => {
                        showToast("Asset updated");
                        loadData();
                    });
                },
                onDeleteAsset: async (id) => {
                    try {
                        await WealthApi.deleteAccount(id, currentMonth);
                        showToast("Asset deleted");
                        loadData();
                    } catch (e) {
                        alert(e.message || "Failed to delete");
                    }
                }
            });

        } catch (e) {
            console.error("[Wealth Tracker] Failed to load month data:", e);
        }
    }

    // ──────────────────────────────────────────
    // 6. View Mode Switching (Dashboard vs Holdings vs Calendar)
    // ──────────────────────────────────────────
    function switchViewMode(mode) {
        activeViewMode = mode;

        // Update active class on sidebar navigation items
        document.querySelectorAll(".sidebar-nav-item").forEach(item => {
            item.classList.toggle("active", item.dataset.view === mode);
        });

        // Toggle page view panels
        if (elements.viewDashboard) elements.viewDashboard.style.display = mode === "dashboard" ? "flex" : "none";
        if (elements.viewPortfolio) elements.viewPortfolio.style.display = mode === "portfolio" ? "flex" : "none";
        if (elements.viewCalendar) elements.viewCalendar.style.display = mode === "calendar" ? "flex" : "none";

        // Update main page title dynamically
        if (elements.pageTitle) {
            if (mode === "dashboard") elements.pageTitle.textContent = "Wealth Dashboard";
            else if (mode === "portfolio") elements.pageTitle.textContent = "Asset Holdings";
            else if (mode === "calendar") elements.pageTitle.textContent = "Monthly Archives";
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // Sidebar navigation listeners
    document.querySelectorAll(".sidebar-nav-item").forEach(item => {
        item.addEventListener("click", () => {
            switchViewMode(item.dataset.view);
        });
    });

    // Jump strip button from Dashboard to Holdings
    if (elements.btnJumpToPortfolio) {
        elements.btnJumpToPortfolio.addEventListener("click", () => {
            switchViewMode("portfolio");
        });
    }

    // ──────────────────────────────────────────
    // 7. Uninitialized Month Quick Inherit Banner
    // ──────────────────────────────────────────
    function renderMonthInitBanner(lastRecordedMonth) {
        if (!elements.monthInitBanner) return;
        elements.monthInitBanner.style.display = "block";
        elements.monthInitBanner.innerHTML = `
            <div style="background:var(--bg-panel); border:1px solid var(--border-default); border-left:3px solid var(--color-brand); border-radius:var(--radius-panel); padding:16px 20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <strong style="font-size:13px; color:var(--text-primary);">New Month Entry (${currentMonth})</strong>
                    <span style="font-size:12px; color:var(--text-secondary);">
                        ${lastRecordedMonth
                            ? `Previous month (${lastRecordedMonth}) has been archived. Click below to copy all assets from ${lastRecordedMonth} into ${currentMonth} for quick balance updates.`
                            : `No asset holdings have been entered for this month yet.`}
                    </span>
                </div>
                <div style="display:flex; gap:8px;">
                    ${lastRecordedMonth ? `
                        <button type="button" id="btn-inherit-last" class="btn btn-primary">
                            ⚡ Copy All Assets from ${lastRecordedMonth}
                        </button>
                    ` : ''}
                    <button type="button" id="btn-start-blank" class="btn btn-secondary">
                        + Add Asset Manually
                    </button>
                </div>
            </div>
        `;

        const inheritBtn = elements.monthInitBanner.querySelector("#btn-inherit-last");
        if (inheritBtn) {
            inheritBtn.addEventListener("click", async () => {
                try {
                    await WealthApi.inheritFromPreviousMonth(lastRecordedMonth, currentMonth);
                    showToast(`Copied assets from ${lastRecordedMonth} into ${currentMonth}`);
                    loadData();
                } catch (err) {
                    alert(err.message || "Failed to inherit previous month");
                }
            });
        }

        const blankBtn = elements.monthInitBanner.querySelector("#btn-start-blank");
        if (blankBtn) {
            blankBtn.addEventListener("click", () => {
                openAssetModal(null, () => loadData());
            });
        }
    }

    // ──────────────────────────────────────────
    // 8. Month Navigation & Action Listeners
    // ──────────────────────────────────────────
    if (elements.headerMonthPicker) {
        elements.headerMonthPicker.addEventListener("change", (e) => {
            if (e.target.value && /^\d{4}-\d{2}$/.test(e.target.value)) {
                currentMonth = e.target.value;
                showToast(`Switched to month ${currentMonth}`);
                loadData();
            }
        });
    }

    if (elements.monthDropdownSelect) {
        elements.monthDropdownSelect.addEventListener("change", (e) => {
            if (e.target.value) {
                currentMonth = e.target.value;
                showToast(`Switched to month ${currentMonth}`);
                loadData();
            }
        });
    }

    if (elements.btnPrevMonth) {
        elements.btnPrevMonth.addEventListener("click", () => {
            currentMonth = offsetMonth(currentMonth, -1);
            showToast(`Switched to month ${currentMonth}`);
            loadData();
        });
    }

    if (elements.btnNextMonth) {
        elements.btnNextMonth.addEventListener("click", () => {
            currentMonth = offsetMonth(currentMonth, 1);
            showToast(`Switched to month ${currentMonth}`);
            loadData();
        });
    }

    if (elements.btnJumpCurrentMonth) {
        elements.btnJumpCurrentMonth.addEventListener("click", () => {
            if (currentMonth !== realCurrentMonth) {
                currentMonth = realCurrentMonth;
                showToast(`Jumped to current month (${realCurrentMonth})`);
                loadData();
            } else {
                showToast(`Already viewing current month (${realCurrentMonth})`);
            }
        });
    }

    if (elements.btnNewMonth) {
        elements.btnNewMonth.addEventListener("click", () => {
            const nextM = offsetMonth(currentMonth, 1);
            const chosen = prompt("Enter target month (YYYY-MM) to start new entry:", nextM);
            if (chosen && /^\d{4}-\d{2}$/.test(chosen)) {
                currentMonth = chosen;
                switchViewMode("portfolio");
                loadData();
            }
        });
    }

    if (elements.headerRatePill) {
        elements.headerRatePill.addEventListener("click", () => {
            const currentRate = currentData?.usd_rate || 4.08;
            openRateModal(currentRate, () => {
                showToast("FX rate updated");
                loadData();
            });
        });
    }

    if (elements.btnTakeSnapshot) {
        elements.btnTakeSnapshot.addEventListener("click", () => {
            const netWorth = currentData?.portfolio?.total_net_worth_myr || 0;
            const usdRate = currentData?.usd_rate || 4.08;
            openSnapshotModal(currentMonth, netWorth, usdRate, (newMonth) => {
                showToast(`Month ${newMonth} archived successfully`);
                currentMonth = newMonth;
                loadData();
            });
        });
    }

    // ──────────────────────────────────────────
    // 9. Keyboard Shortcuts
    // ──────────────────────────────────────────
    window.addEventListener("keydown", (e) => {
        const tag = document.activeElement ? document.activeElement.tagName.toUpperCase() : "";
        if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
            if (e.key === "Escape") document.activeElement.blur();
            return;
        }

        if (e.key === "t" || e.key === "T") toggleTheme();
        else if (e.key === "1") window.location.href = "../calculator/index.html";
        else if (e.key === "2") window.location.href = "../Journal/index.html";
        else if (e.key === "d" || e.key === "D" || e.key === "0") {
            e.preventDefault();
            switchViewMode("dashboard");
        }
        else if (e.key === "h" || e.key === "H") {
            e.preventDefault();
            switchViewMode("portfolio");
        }
        else if (e.key === "c" || e.key === "C") {
            e.preventDefault();
            switchViewMode(activeViewMode === "calendar" ? "dashboard" : "calendar");
        }
        else if (e.key === "a" || e.key === "A") {
            e.preventDefault();
            openAssetModal(null, () => loadData());
        }
        else if (e.key === "s" || e.key === "S") {
            e.preventDefault();
            const netWorth = currentData?.portfolio?.total_net_worth_myr || 0;
            const usdRate = currentData?.usd_rate || 4.08;
            openSnapshotModal(currentMonth, netWorth, usdRate, () => loadData());
        }
    });

    // Mobile zoom guard
    document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });

    // Initialize application
    const isAuthed = await checkAuthAndEntitlements();
    if (isAuthed) {
        await loadData();
    }
});
