/**
 * Veyra Trading - Main Page App Portal Controller
 * Handles auth state, app tile lock overlays, and admin navigation.
 */

import { getCurrentUserAndProfile, signOut } from "../js/auth/authState.js?v=4";

document.addEventListener("DOMContentLoaded", () => {
    const elements = {
        themeToggleBtn: document.getElementById("theme-toggle-btn"),
        comingSoonCards: document.querySelectorAll(".app-coming-soon, .app-card-coming-soon"),
        launcherToast: document.getElementById("launcher-toast"),
        launcherToastMessage: document.getElementById("launcher-toast-message"),
        authContainer: document.getElementById("auth-status-container"),
        appLinkJournal: document.getElementById("app-link-journal"),
        lockToast: document.getElementById("lock-toast")
    };

    // ──────────────────────────────────────────
    // Theme System
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
        try { localStorage.setItem("calc_theme", theme); } catch (e) {}
    }

    function toggleTheme() {
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        applyTheme(isDark ? "light" : "dark");
    }

    if (elements.themeToggleBtn) {
        elements.themeToggleBtn.addEventListener("click", toggleTheme);
    }

    if (window.matchMedia) {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
            try { if (!localStorage.getItem("calc_theme")) applyTheme(e.matches ? "dark" : "light"); } catch (err) {}
        });
    }

    try {
        const savedTheme = localStorage.getItem("calc_theme");
        if (savedTheme) {
            applyTheme(savedTheme);
        } else {
            applyTheme(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        }
    } catch (e) { applyTheme("light"); }

    // ──────────────────────────────────────────
    // Keyboard Shortcuts
    // ──────────────────────────────────────────
    window.addEventListener("keydown", (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toUpperCase() : "";
        if (["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) {
            if (e.key === "Escape") document.activeElement.blur();
            return;
        }
        if (e.key === "1") window.location.href = "../calculator/index.html";
        else if (e.key === "2") window.location.href = "../Journal/index.html";
        else if (e.key === "3") window.location.href = "../wealth/index.html";
        else if (e.key === "t" || e.key === "T") toggleTheme();
    });

    // ──────────────────────────────────────────
    // Coming Soon Toast
    // ──────────────────────────────────────────
    let toastTimeout = null;
    function showToast(message, isLock = false) {
        const toast = elements.launcherToast;
        const msg = elements.launcherToastMessage;
        if (!toast || !msg) return;
        msg.textContent = message;
        toast.classList.remove("hidden", "lock-toast-variant");
        if (isLock) toast.classList.add("lock-toast-variant");
        void toast.offsetWidth;
        toast.classList.add("visible");
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove("visible");
            setTimeout(() => toast.classList.add("hidden"), 250);
        }, 2500);
    }

    if (elements.comingSoonCards) {
        elements.comingSoonCards.forEach(card => {
            card.addEventListener("click", () => {
                const appName = card.dataset.appName || "Application";
                showToast(`${appName} — Coming soon in V2.0`);
            });
        });
    }

    // ──────────────────────────────────────────
    // Auth State & App Lock System
    // ──────────────────────────────────────────
    async function syncAll() {
        let profile = null;
        let user = null;

        try {
            const result = await getCurrentUserAndProfile();
            user = result.user;
            profile = result.profile;
        } catch (e) {
            console.warn("[Veyra Auth] Header status error:", e);
        }

        const isLoggedIn = !!(user && profile && profile.status === "active");
        const isAdmin = isLoggedIn && profile.role === "admin";

        // ── Header Auth Status ──
        if (elements.authContainer) {
            if (isLoggedIn) {
                const initial = (profile.display_name || profile.username || profile.email || "U").charAt(0).toUpperCase();
                const planTag = (profile.plan_id || "free").toUpperCase();
                elements.authContainer.innerHTML = `
                    <div class="user-badge-pill">
                        <span class="user-avatar-dot">${initial}</span>
                        <span class="user-name-text" title="${profile.email || ''}">${profile.display_name || profile.username || profile.email}</span>
                        ${isAdmin
                            ? `<span class="user-role-tag user-role-admin">ADMIN</span>`
                            : `<span class="user-role-tag">${planTag}</span>`}
                        ${isAdmin
                            ? `<a href="../admin/index.html" class="btn-admin-nav" title="Admin Console">Admin ↗</a>`
                            : ""}
                        <button type="button" id="btn-header-signout" class="btn-header-signout" title="Sign Out">Sign out</button>
                    </div>
                `;
                const signoutBtn = document.getElementById("btn-header-signout");
                if (signoutBtn) {
                    signoutBtn.addEventListener("click", async () => {
                        await signOut();
                        window.location.reload();
                    });
                }
            } else {
                elements.authContainer.innerHTML = `
                    <a href="../auth/login.html" id="btn-header-signin" class="btn-header-signin">Sign In</a>
                `;
            }
        }

        // ── Helper: Configure App Tile Lock State ──
        function configureTile(tile, isLocked, lockLabel, lockToastMsg, targetUrl) {
            if (!tile) return;
            const squircle = tile.querySelector(".app-icon-squircle");
            const legacyRoot = tile.querySelector(":scope > .tile-lock-overlay");
            if (legacyRoot) legacyRoot.remove();

            if (isLocked) {
                tile.classList.add("app-tile-locked");
                tile.setAttribute("data-locked", "true");
                tile.removeAttribute("href");
                if (squircle && !squircle.querySelector(".tile-lock-overlay")) {
                    squircle.insertAdjacentHTML("beforeend", `
                        <div class="tile-lock-overlay" aria-hidden="true">
                            <div class="tile-lock-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                            </div>
                            <span class="tile-lock-label">${lockLabel}</span>
                        </div>
                    `);
                }
                tile.onclick = (e) => {
                    e.preventDefault();
                    showToast(lockToastMsg, true);
                };
            } else {
                tile.classList.remove("app-tile-locked");
                tile.removeAttribute("data-locked");
                tile.querySelectorAll(".tile-lock-overlay").forEach(el => el.remove());
                tile.onclick = () => {
                    window.location.href = targetUrl;
                };
            }

            tile.onkeydown = (e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    tile.click();
                }
            };
        }

        // ── 1. Position Size Calculator Entitlement ──
        const calcTile = document.getElementById("app-link-calculator");
        const calcOverride = profile?.app_overrides?.lot_size_calculator;
        const isCalcLocked = (isLoggedIn && calcOverride === false);
        configureTile(
            calcTile,
            isCalcLocked,
            "Access<br>Revoked",
            "Access to Position Size Calculator has been restricted by administrator",
            "../calculator/index.html"
        );

        // ── 2. Trade Journal Entitlement ──
        const journalTile = document.getElementById("app-link-journal");
        let isJournalLocked = false;
        let journalLabel = "Sign in<br>required";
        let journalToast = "Sign in to access Trade Journal";

        if (!isLoggedIn) {
            isJournalLocked = true;
            journalLabel = "Sign in<br>required";
            journalToast = "Sign in to access Trade Journal";
        } else if (isAdmin) {
            isJournalLocked = false;
        } else {
            const jOverride = profile?.app_overrides?.trading_journal;
            if (jOverride === false) {
                isJournalLocked = true;
                journalLabel = "Access<br>Revoked";
                journalToast = "Access to Trade Journal has been restricted by administrator";
            } else if (jOverride === true) {
                isJournalLocked = false;
            } else if (profile?.plan_id === "free") {
                isJournalLocked = true;
                journalLabel = "Pro plan<br>required";
                journalToast = "Pro plan required for Trade Journal";
            } else {
                isJournalLocked = false;
            }
        }

        configureTile(
            journalTile,
            isJournalLocked,
            journalLabel,
            journalToast,
            "../Journal/index.html"
        );

        // ── 3. Wealth Tracker Entitlement ──
        const wealthTile = document.getElementById("app-link-wealth");
        let isWealthLocked = false;
        let wealthLabel = "Sign in<br>required";
        let wealthToast = "Sign in to access Wealth Tracker";

        if (!isLoggedIn) {
            isWealthLocked = true;
            wealthLabel = "Sign in<br>required";
            wealthToast = "Sign in to access Wealth Tracker";
        } else if (isAdmin) {
            isWealthLocked = false;
        } else {
            const wOverride = profile?.app_overrides?.wealth_tracker;
            if (wOverride === false) {
                isWealthLocked = true;
                wealthLabel = "Access<br>Revoked";
                wealthToast = "Access to Wealth Tracker has been restricted by administrator";
            } else if (wOverride === true) {
                isWealthLocked = false;
            } else if (profile?.plan_id === "free") {
                isWealthLocked = true;
                wealthLabel = "Pro plan<br>required";
                wealthToast = "Pro plan required for Wealth Tracker";
            } else {
                isWealthLocked = false;
            }
        }

        configureTile(
            wealthTile,
            isWealthLocked,
            wealthLabel,
            wealthToast,
            "../wealth/index.html"
        );
    }

    syncAll();

    // Prevent accidental mobile zoom
    document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
    document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
    document.addEventListener("gestureend", (e) => e.preventDefault(), { passive: false });
    document.addEventListener("selectstart", (e) => {
        if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") e.preventDefault();
    });
});
