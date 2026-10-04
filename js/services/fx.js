/**
 * js/services/fx.js
 * Veyra Platform Unified USD/MYR Foreign Exchange (FX) Service
 * Sourced from Frankfurter daily reference rates (https://api.frankfurter.dev/v2/rate/usd/myr)
 *
 * Invariants:
 * 1. Single source of truth across all Veyra applications (window.VEYRA_FX / fxService).
 * 2. Zero manual user input - automated fetch with resilient fallback.
 * 3. In-flight request deduplication via shared Promise.
 * 4. 5000ms AbortController timeout & strict JSON schema validation.
 * 5. Persistent localStorage cache (veyra_usd_myr_rate) with 24-hour TTL & stale fallback.
 * 6. High-precision raw calculations; .toFixed(4) restricted strictly to UI display.
 */

export const FX_API_URL = "https://api.frankfurter.dev/v2/rate/usd/myr";
export const FX_CACHE_KEY = "veyra_usd_myr_rate";
export const FX_TIMEOUT_MS = 5000;
export const FX_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24-hour cache validity

// Shared in-flight promise to prevent concurrent duplicate API requests
let fxRequestPromise = null;

/**
 * Fetch latest USD/MYR rate directly from Frankfurter API with timeout and payload validation.
 * @returns {Promise<{ rate: number, date: string, base: string, quote: string }>}
 */
export async function fetchUSDMYRRate() {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, FX_TIMEOUT_MS);

    try {
        const response = await fetch(FX_API_URL, {
            signal: controller.signal,
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`FX API HTTP error: ${response.status}`);
        }

        const data = await response.json();

        // Strict schema and numerical invariant validation
        if (
            !data ||
            data.base !== "USD" ||
            data.quote !== "MYR" ||
            typeof data.rate !== "number" ||
            !Number.isFinite(data.rate) ||
            data.rate <= 0
        ) {
            throw new Error("Invalid USD/MYR payload received from Frankfurter API");
        }

        return {
            rate: data.rate,
            date: typeof data.date === "string" ? data.date : new Date().toISOString().slice(0, 10),
            base: data.base,
            quote: data.quote
        };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Safely retrieve valid cached USD/MYR rate from localStorage.
 * @returns {{ rate: number, date: string, fetchedAt: number, isFallback?: boolean } | null}
 */
export function getCachedUSDMYRRate() {
    try {
        const raw = localStorage.getItem(FX_CACHE_KEY);
        if (!raw) return null;

        const cached = JSON.parse(raw);
        if (
            !cached ||
            typeof cached.rate !== "number" ||
            !Number.isFinite(cached.rate) ||
            cached.rate <= 0
        ) {
            return null;
        }

        return cached;
    } catch (_) {
        return null;
    }
}

/**
 * Get USD/MYR rate with intelligent caching, deduplication, and graceful fallback.
 * @param {Object} [options]
 * @param {boolean} [options.forceRefresh=false] - Bypass fresh cache and fetch from API
 * @returns {Promise<{ rate: number, date: string, fetchedAt: number, isFallback: boolean }>}
 */
export async function getUSDMYRRate(options = {}) {
    const { forceRefresh = false } = options;
    const cached = getCachedUSDMYRRate();

    // Cache check: return cached if still within TTL and not forcing refresh
    const isFresh = cached && cached.fetchedAt && (Date.now() - cached.fetchedAt < FX_CACHE_TTL_MS);
    if (!forceRefresh && isFresh) {
        return {
            ...cached,
            isFallback: false
        };
    }

    // Deduplicate in-flight requests
    if (!forceRefresh && fxRequestPromise) {
        return fxRequestPromise;
    }

    fxRequestPromise = (async () => {
        try {
            const fresh = await fetchUSDMYRRate();
            const result = {
                rate: fresh.rate,
                date: fresh.date,
                fetchedAt: Date.now(),
                isFallback: false
            };

            try {
                localStorage.setItem(FX_CACHE_KEY, JSON.stringify(result));
            } catch (_) {}

            return result;
        } catch (error) {
            console.warn("[Veyra FX] Failed to fetch live rate from Frankfurter:", error?.message || error);

            // Situation A: Previous cached rate exists -> use as graceful fallback
            if (cached) {
                return {
                    ...cached,
                    isFallback: true
                };
            }

            // Situation B: No cache exists -> re-throw to let caller handle unavailable state
            throw error;
        }
    })().finally(() => {
        fxRequestPromise = null;
    });

    return fxRequestPromise;
}

/**
 * Universal USD to MYR conversion using active runtime exchange rate.
 * Uses exact raw floating-point rate without premature rounding.
 *
 * @param {number} amountUSD
 * @returns {number|null} Returns calculated MYR amount or null if inputs/rate are invalid.
 */
export function convertUSDToMYR(amountUSD) {
    const rate = window.VEYRA_FX?.USDMYR;

    if (
        typeof amountUSD !== "number" ||
        !Number.isFinite(amountUSD)
    ) {
        return null;
    }

    if (
        typeof rate !== "number" ||
        !Number.isFinite(rate) ||
        rate <= 0
    ) {
        return null;
    }

    return amountUSD * rate;
}

/**
 * Format FX rate for UI display (4 decimal places standard).
 * @param {number|null} rate
 * @returns {string} Formatted string or placeholder '—'
 */
export function formatFXRate(rate) {
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
        return "—";
    }
    return rate.toFixed(4);
}

/**
 * Get active USD/MYR rate synchronously from runtime state or cache.
 * Returns null if no rate is currently available (never guesses or hardcodes).
 * @returns {number|null}
 */
export function getActiveFXRate() {
    if (typeof window.VEYRA_FX?.USDMYR === "number" && window.VEYRA_FX.USDMYR > 0) {
        return window.VEYRA_FX.USDMYR;
    }
    const cached = getCachedUSDMYRRate();
    if (cached && typeof cached.rate === "number" && cached.rate > 0) {
        return cached.rate;
    }
    return null;
}

/**
 * Global initialization handler.
 * Called automatically during page entry to establish window.VEYRA_FX runtime state.
 * Guaranteed never to crash the page or produce unhandled promise rejections.
 */
export async function initializeFX() {
    // 1. Establish baseline runtime state
    if (!window.VEYRA_FX) {
        window.VEYRA_FX = {
            USDMYR: null,
            date: null,
            isFallback: false,
            status: "loading" // "loading" | "ready" | "unavailable"
        };
    }

    // 2. Immediate optimistic fill from local cache (prevents visual layout shift / 0 flicker)
    const cached = getCachedUSDMYRRate();
    if (cached) {
        window.VEYRA_FX.USDMYR = cached.rate;
        window.VEYRA_FX.date = cached.date;
        window.VEYRA_FX.isFallback = Boolean(cached.isFallback);
        window.VEYRA_FX.status = "ready";
    }

    // 3. Request fresh or validated rate
    try {
        const fx = await getUSDMYRRate();

        window.VEYRA_FX = {
            USDMYR: fx.rate,
            date: fx.date,
            isFallback: Boolean(fx.isFallback),
            status: "ready"
        };

        window.dispatchEvent(new CustomEvent("veyra:fx:updated", { detail: window.VEYRA_FX }));
        return window.VEYRA_FX;
    } catch (error) {
        console.warn("[Veyra FX] Live initialization failed, checking fallback:", error?.message || error);

        if (window.VEYRA_FX.USDMYR) {
            // Already populated from cache
            window.VEYRA_FX.isFallback = true;
            window.VEYRA_FX.status = "ready";
        } else {
            // No cache available
            window.VEYRA_FX = {
                USDMYR: null,
                date: null,
                isFallback: false,
                status: "unavailable"
            };
        }

        window.dispatchEvent(new CustomEvent("veyra:fx:error", { detail: window.VEYRA_FX }));
        return window.VEYRA_FX;
    }
}

// Universal Service Export
export const fxService = {
    fetchUSDMYRRate,
    getCachedUSDMYRRate,
    getUSDMYRRate,
    convertUSDToMYR,
    formatFXRate,
    getActiveFXRate,
    initializeFX,
    getUSDMYR: () => window.VEYRA_FX?.USDMYR || getActiveFXRate()
};

// Bind to window for non-module scripts and global access
if (typeof window !== "undefined") {
    window.fxService = fxService;
    if (!window.VEYRA_FX) {
        const cached = getCachedUSDMYRRate();
        window.VEYRA_FX = {
            USDMYR: cached?.rate || null,
            date: cached?.date || null,
            isFallback: Boolean(cached?.isFallback),
            status: cached ? "ready" : "loading"
        };
    }
}
