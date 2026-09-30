/**
 * Veyra Trading - Main Page App Portal Controller
 * Conforming 1:1 to Calculator UI & Interaction Standards
 */

import { getCurrentUserAndProfile, signOut } from "../js/auth/authState.js";

document.addEventListener("DOMContentLoaded", () => {
    const elements = {
        themeToggleBtn: document.getElementById("theme-toggle-btn"),
        comingSoonCards: document.querySelectorAll(".app-coming-soon, .app-card-coming-soon"),
        launcherToast: document.getElementById("launcher-toast"),
        launcherToastMessage: document.getElementById("launcher-toast-message")
    };

    // Theme Switcher (Identical SVG Icons to Calculator)
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
        try {
            localStorage.setItem("calc_theme", theme);
        } catch (e) {
            // ignore storage errors
        }
    }

    function toggleTheme() {
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        applyTheme(isDark ? "light" : "dark");
    }

    if (elements.themeToggleBtn) {
        elements.themeToggleBtn.addEventListener("click", toggleTheme);
    }

    // System theme preference listener
    if (window.matchMedia) {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
            try {
                if (!localStorage.getItem("calc_theme")) {
                    applyTheme(e.matches ? "dark" : "light");
                }
            } catch (err) {}
        });
    }

    // Desktop Keyboard Shortcuts: 1 for Calculator, T for Theme
    window.addEventListener("keydown", (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toUpperCase() : "";
        const isInputActive = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";

        if (isInputActive) {
            if (e.key === "Escape") {
                document.activeElement.blur();
            }
            return;
        }

        if (e.key === "1") {
            window.location.href = "../calculator/index.html";
        } else if (e.key === "2") {
            window.location.href = "../Journal/index.html";
        } else if (e.key === "t" || e.key === "T") {
            toggleTheme();
        }
    });

    // Coming Soon Apps Toast Notification
    let toastTimeout = null;
    function showToast(message) {
        if (!elements.launcherToast || !elements.launcherToastMessage) return;
        elements.launcherToastMessage.textContent = message;
        elements.launcherToast.classList.remove("hidden");
        void elements.launcherToast.offsetWidth;
        elements.launcherToast.classList.add("visible");

        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            elements.launcherToast.classList.remove("visible");
            setTimeout(() => {
                elements.launcherToast.classList.add("hidden");
            }, 250);
        }, 2200);
    }

    if (elements.comingSoonCards) {
        elements.comingSoonCards.forEach(card => {
            card.addEventListener("click", () => {
                const appName = card.dataset.appName || "Application";
                showToast(`${appName} is coming soon in V2.0`);
            });
        });
    }

    // Initial Theme Load (Synchronized with Calculator)
    try {
        const savedTheme = localStorage.getItem("calc_theme");
        if (savedTheme) {
            applyTheme(savedTheme);
        } else {
            const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
            applyTheme(prefersDark ? "dark" : "light");
        }
    } catch (e) {
        applyTheme("light");
    }

    // User Authentication Status Synchronization
    const authContainer = document.getElementById("auth-status-container");
    async function syncHeaderAuthState() {
        if (!authContainer) return;
        try {
            const { user, profile } = await getCurrentUserAndProfile();
            if (user && profile && profile.status === "active") {
                const initial = (profile.display_name || profile.email || "U").charAt(0).toUpperCase();
                const isAdmin = profile.role === "admin";
                const planTag = (profile.plan_id || "free").toUpperCase();

                authContainer.innerHTML = `
                    <div class="user-badge-pill">
                        <span class="user-avatar-dot">${initial}</span>
                        <span class="user-name-text" title="${profile.email}">${profile.display_name || profile.email}</span>
                        ${isAdmin ? `<span class="user-role-tag user-role-admin">ADMIN</span>` : `<span class="user-role-tag">${planTag}</span>`}
                        ${isAdmin ? `<a href="../admin/index.html" class="btn-admin-nav" title="Admin Console">Admin</a>` : ""}
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
                authContainer.innerHTML = `
                    <a href="../auth/login.html" id="btn-header-signin" class="btn-header-signin">Sign In</a>
                `;
            }
        } catch (e) {
            console.warn("[Veyra Auth] Header status error:", e);
        }
    }

    syncHeaderAuthState();

    // Accidental Mobile Zoom Prevention
    document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
    document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
    document.addEventListener("gestureend", (e) => e.preventDefault(), { passive: false });

    // Prevent text selection across displayed text
    document.addEventListener("selectstart", (e) => {
        if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
            e.preventDefault();
        }
    });
});

