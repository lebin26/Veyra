/**
 * Professional Quantitative Reverse-Deduction Risk & Leverage Engine
 * - XAUUSD: Ultra-Minimal Flat Lot Size Calculator
 *     - USD Account: 1 Lot = 100 oz
 *     - USC Cent Account: 1 Lot = 1 oz
 *     - SL Modes: SL Pips (Default 150) | 差价 ($) | Entry / SL
 * - BTCUSDT: 
 *     - Mode 1: Risk Sizing (Equity + Risk% + SL → Lot Size + Margin + Safe Leverage)
 *     - Mode 2: Custom Lot (Equity + Lot Size + SL + TP → TP/SL PnL + R:R + Margin + Safe Leverage)
 *     - SL Modes: Price | 差价 ($) | 比例 (%)
 */

// 1. Asset Specifications
const INSTRUMENTS = {
    "BTCUSDT.P": {
        symbol: "BTCUSDT",
        title: "Position Size Calculator",
        subtitle: "",
        isCrypto: true,
        contractSize: 1,   // 1 BTC per 1.00 lot
        pipSize: 1.00
    },
    XAUUSD: {
        symbol: "XAUUSD",
        title: "Position Size Calculator",
        subtitle: "",
        isCrypto: false,
        contractSize: 100, // 100 oz per 1.00 standard USD lot
        pipSize: 0.10      // 1 pip = 0.10 USD
    }
};

let currentInstrumentKey = "XAUUSD";
let currentCalcMode = "risk"; // 'risk' | 'lot'
let activeXauSlMode = "pips"; // 'pips' | 'diff' | 'price'
let activeBtcSlMode = "price"; // 'price' | 'diff' | 'pct'
let cryptoTradeSide = "long"; // 'long' | 'short'
let isAutoSafeLeverage = true; // Auto reverse-deduced safe leverage by default
let manualLeverage = 10;
let calculatedMaxSafeLeverage = 50;

// 2. Pure Calculation Engine
const Calculator = {
    calculateRiskAmount(balance, riskPercent) {
        if (balance <= 0 || riskPercent <= 0) return 0;
        return (balance * riskPercent) / 100;
    },

    calculateExactLot(riskAmount, priceDistance, contractSize) {
        const lossPerLot = priceDistance * contractSize;
        if (riskAmount <= 0 || lossPerLot <= 0) return 0;
        return riskAmount / lossPerLot;
    },

    calculateLotSize(exactLot, lotStep) {
        if (exactLot <= 0 || lotStep <= 0) return 0;
        const steps = Math.floor((exactLot + 1e-9) / lotStep);
        return steps * lotStep;
    },

    /**
     * Reverse-Deduce Maximum Safe Leverage (防爆仓最高安全杠杆 - 保守估算)
     * 计入交易所阶梯维持保证金率 (0.33%-0.5%) + 强平平仓手续费与滑点安全冗余 (0.2%)
     * 主动降低推荐杠杆，100% 确保强平价绝不先于止损线触发。
     * Formula: floor(1 / (slPct + MMR + FeeBuffer))
     */
    calculateMaxSafeLeverage(entryPrice, slPrice, mmr = 0.004, feeBuffer = 0.002) {
        if (entryPrice <= 0 || slPrice <= 0 || entryPrice === slPrice) {
            return 50;
        }
        const slDistance = Math.abs(entryPrice - slPrice);
        const slPct = slDistance / entryPrice;
        // Total reserve = MMR + Fee & Slippage Buffer (直接降低杠杆，保守预估)
        const totalReserve = mmr + feeBuffer;
        const rawLev = 1 / (slPct + totalReserve);
        const safeLev = Math.floor(rawLev);
        return Math.min(150, Math.max(1, safeLev));
    },

    /**
     * Estimated Liquidation Price (对齐 Bybit 逐仓实盘强平模型)
     * 真实计入维持保证金率与平仓 Taker 预留费率 (约 0.0033)
     */
    calculateLiqPrice(entryPrice, leverage, side, totalReserve = 0.0033) {
        if (entryPrice <= 0 || leverage <= 0) return 0;
        if (side === "long") {
            const liq = entryPrice * (1 - (1 / leverage) + totalReserve);
            return liq > 0 ? liq : 0;
        } else {
            const liq = entryPrice * (1 + (1 / leverage) - totalReserve);
            return liq > 0 ? liq : 0;
        }
    }
};

// 3. UI Controller
document.addEventListener("DOMContentLoaded", () => {
    const elements = {
        appTitle: document.getElementById("app-title"),
        appSubtitle: document.getElementById("app-subtitle"),
        
        btnXauusd: document.getElementById("sym-xauusd"),
        btnBtcusdt: document.getElementById("sym-btcusdt"),
        themeToggleBtn: document.getElementById("theme-toggle-btn"),
        themeIcon: document.getElementById("theme-icon"),
        
        // Mode Switcher Elements
        modeRiskSizing: document.getElementById("mode-risk-sizing"),
        modeCustomLot: document.getElementById("mode-custom-lot"),
        modeRiskGrid: document.getElementById("mode-risk-grid"),
        modeLotGrid: document.getElementById("mode-lot-grid"),
        riskPresetsBar: document.getElementById("risk-presets-bar"),
        lotPresetsBar: document.getElementById("lot-presets-bar"),
        riskSummaryBar: document.getElementById("risk-summary-bar"),
        accountSectionTitle: document.getElementById("account-section-title"),
        resultsSectionTitle: document.getElementById("results-section-title"),
        riskModeResults: document.getElementById("risk-mode-results"),
        lotModeResults: document.getElementById("lot-mode-results"),
        
        accountBalanceLot: document.getElementById("account-balance-lot"),
        customLotInput: document.getElementById("custom-lot-input"),
        customLotSuffix: document.getElementById("custom-lot-suffix"),
        btnLotMinus: document.getElementById("btn-lot-minus"),
        btnLotPlus: document.getElementById("btn-lot-plus"),
        lotStepIndicator: document.getElementById("lot-step-indicator"),
        lotPresetButtons: document.querySelectorAll(".lot-preset-btn"),
        
        // PnL Cards
        pnlTpVal: document.getElementById("pnl-tp-val"),
        pnlTpFooter: document.getElementById("pnl-tp-footer"),
        pnlSlVal: document.getElementById("pnl-sl-val"),
        pnlSlFooter: document.getElementById("pnl-sl-footer"),
        pnlRrVal: document.getElementById("pnl-rr-val"),
        pnlRrFooter: document.getElementById("pnl-rr-footer"),
        pillRiskLabel: document.getElementById("pill-risk-label"),
        
        // Sections
        xauSlSection: document.getElementById("xau-sl-section"),
        cryptoPositionSection: document.getElementById("crypto-position-section"),
        cryptoPosMetrics: document.getElementById("crypto-pos-metrics"),
        cryptoLeverageSection: document.getElementById("crypto-leverage-section"),
        
        // Account Inputs
        balanceInput: document.getElementById("account-balance"),
        riskInput: document.getElementById("risk-percent"),
        displayRiskAmount: document.getElementById("display-risk-amount"),
        
        // XAU Controls
        tabPips: document.getElementById("tab-pips"),
        tabXauDiff: document.getElementById("tab-xau-diff"),
        tabPrice: document.getElementById("tab-price"),
        pipsSection: document.getElementById("pips-input-section"),
        xauDiffSection: document.getElementById("xau-diff-input-section"),
        priceSection: document.getElementById("price-input-section"),
        slPipsInput: document.getElementById("sl-pips"),
        xauSlDiffInput: document.getElementById("xau-sl-diff"),
        xauEntryPriceInput: document.getElementById("xau-entry-price"),
        xauSlPriceInput: document.getElementById("xau-sl-price"),
        displayPriceDistance: document.getElementById("display-price-distance"),
        
        // BTC SL Modes
        btcModePrice: document.getElementById("btc-mode-price"),
        btcModeDiff: document.getElementById("btc-mode-diff"),
        btcModePct: document.getElementById("btc-mode-pct"),
        
        cryptoSlPriceGroup: document.getElementById("crypto-sl-price-group"),
        cryptoSlDiffGroup: document.getElementById("crypto-sl-diff-group"),
        cryptoSlPctGroup: document.getElementById("crypto-sl-pct-group"),
        
        cryptoSlPriceInput: document.getElementById("crypto-sl-price"),
        cryptoSlDiffInput: document.getElementById("crypto-sl-diff"),
        cryptoSlPctInput: document.getElementById("crypto-sl-pct"),
        
        // Crypto Controls
        sideLong: document.getElementById("side-long"),
        sideShort: document.getElementById("side-short"),
        cryptoEntryPriceInput: document.getElementById("crypto-entry-price"),
        cryptoTpPriceInput: document.getElementById("crypto-tp-price"),
        displayCryptoSlDist: document.getElementById("display-crypto-sl-dist"),
        
        // Lot Output Elements
        lotUsdVal: document.getElementById("lot-usd-val"),
        lotUscVal: document.getElementById("lot-usc-val"),
        lotUscBadge: document.getElementById("lot-usc-badge"),
        lotUscCentHint: document.getElementById("lot-usc-cent-hint"),
        lotBybitVal: document.getElementById("lot-bybit-val"),
        lotUsdFooter: document.getElementById("lot-usd-footer"),
        lotBybitFooter: document.getElementById("lot-bybit-footer"),
        
        displayPosVal: document.getElementById("display-pos-val"),
        displayActualRisk: document.getElementById("display-actual-risk"),
        
        // Leverage Elements
        leverageTriggerBtn: document.getElementById("leverage-trigger-btn"),
        leverageDisplayText: document.getElementById("leverage-display-text"),
        leverageMenu: document.getElementById("leverage-menu"),
        levMenuButtons: document.querySelectorAll(".lev-menu-btn"),
        btnMenuAutoSafe: document.getElementById("btn-menu-auto-safe"),
        leverageCustomInput: document.getElementById("leverage-custom-input"),
        
        // Safety HUD & Alerts
        cryptoSafeLevBadge: document.getElementById("crypto-safe-lev-badge"),
        cryptoEffectiveLev: document.getElementById("crypto-effective-lev"),
        levDangerBanner: document.getElementById("lev-danger-banner"),
        dangerSuggestLev: document.getElementById("danger-suggest-lev"),
        
        cryptoMargin: document.getElementById("crypto-margin"),
        cryptoLiqPrice: document.getElementById("crypto-liq-price"),
        cryptoLiqBuffer: document.getElementById("crypto-liq-buffer"),
        cryptoSlLoss: document.getElementById("crypto-sl-loss"),
        
        matrixTbody: document.getElementById("matrix-tbody"),
        validationError: document.getElementById("validation-error"),
        resultsEmptyHint: document.getElementById("results-empty-hint"),
        resultPanel: document.querySelector(".result-panel"),
        leverageCollapseTrigger: document.getElementById("leverage-collapse-trigger"),
        leverageCollapseDrawer: document.getElementById("leverage-collapse-drawer"),
        btnToggleFormula: document.getElementById("btn-toggle-formula"),
        formulaDrawer: document.getElementById("formula-drawer"),
        cryptoLiqDot: document.getElementById("crypto-liq-dot"),
        trustAssumptionText: document.getElementById("trust-assumption-text"),

        // Risk presets & Mobile Sticky bar elements
        riskPresetButtons: document.querySelectorAll(".risk-preset-btn"),
        copyableRows: document.querySelectorAll(".copyable-row"),
        mobileStickyBar: document.getElementById("mobile-sticky-bar"),
        mobileStickyInfo: document.getElementById("mobile-sticky-info"),
        mobileStickyName: document.getElementById("mobile-sticky-name"),
        mobileStickyLot: document.getElementById("mobile-sticky-lot"),
        mobileStickyUnit: document.getElementById("mobile-sticky-unit"),
        mobileStickyRisk: document.getElementById("mobile-sticky-risk"),
        btnMobileCopy: document.getElementById("btn-mobile-copy"),
        mobileCopyText: document.getElementById("mobile-copy-text"),
        btnMobileViewResults: document.getElementById("btn-mobile-view-results")
    };

    // Clipboard Copy Helper with Visual Feedback
    function copyTextToClipboard(text, badgeEl) {
        if (!text || text === "—") return;
        const cleanText = text.replace(/[^0-9.-]/g, "").trim();
        if (!cleanText) return;

        function showSuccess() {
            if (badgeEl) {
                badgeEl.classList.add("visible");
                setTimeout(() => badgeEl.classList.remove("visible"), 1400);
            }
        }

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(cleanText).then(showSuccess).catch(() => {
                fallbackCopy(cleanText, showSuccess);
            });
        } else {
            fallbackCopy(cleanText, showSuccess);
        }
    }

    function fallbackCopy(text, cb) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand("copy");
            if (cb) cb();
        } catch (err) {
            console.error("Fallback copy error", err);
        }
        document.body.removeChild(textArea);
    }

    // Segmented slider positioning helper
    function updateSegmentedSlider(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const slider = container.querySelector(".segmented-slider");
        const activeBtn = container.querySelector(".segmented-btn.active");
        if (!slider || !activeBtn) return;

        const buttons = Array.from(container.querySelectorAll(".segmented-btn"));
        const index = buttons.indexOf(activeBtn);
        const count = buttons.length;
        if (index >= 0 && count > 0) {
            slider.style.width = `calc((100% - 4px) / ${count})`;
            slider.style.transform = `translateX(${index * 100}%)`;
        }
    }

    function syncAllSegmentedSliders() {
        updateSegmentedSlider("instrument-segmented");
        updateSegmentedSlider("calc-mode-segmented");
        updateSegmentedSlider("xau-sl-segmented");
        updateSegmentedSlider("crypto-side-segmented");
        updateSegmentedSlider("btc-sl-segmented");
    }

    // Micro-animation helper for updated values
    function triggerValAnimation(el) {
        if (!el) return;
        el.classList.remove("val-updated");
        void el.offsetWidth;
        el.classList.add("val-updated");
    }

    // Input error highlighting
    function clearInputErrors() {
        document.querySelectorAll(".input-control.has-error").forEach(el => el.classList.remove("has-error"));
        document.querySelectorAll(".stepper-control.has-error").forEach(el => el.classList.remove("has-error"));
    }

    function highlightErrorInput(msg) {
        clearInputErrors();
        const lower = (msg || "").toLowerCase();
        if (lower.includes("balance") || lower.includes("equity")) {
            elements.balanceInput?.closest(".input-control")?.classList.add("has-error");
            elements.accountBalanceLot?.closest(".input-control")?.classList.add("has-error");
        } else if (lower.includes("risk")) {
            elements.riskInput?.closest(".input-control")?.classList.add("has-error");
        } else if (lower.includes("custom lot")) {
            elements.customLotInput?.closest(".stepper-control")?.classList.add("has-error");
        } else if (lower.includes("stop loss") || lower.includes("sl")) {
            elements.slPipsInput?.closest(".input-control")?.classList.add("has-error");
            elements.xauSlDiffInput?.closest(".input-control")?.classList.add("has-error");
            elements.xauSlPriceInput?.closest(".input-control")?.classList.add("has-error");
            elements.cryptoSlPriceInput?.closest(".input-control")?.classList.add("has-error");
            elements.cryptoSlDiffInput?.closest(".input-control")?.classList.add("has-error");
            elements.cryptoSlPctInput?.closest(".input-control")?.classList.add("has-error");
        } else if (lower.includes("entry")) {
            elements.xauEntryPriceInput?.closest(".input-control")?.classList.add("has-error");
            elements.cryptoEntryPriceInput?.closest(".input-control")?.classList.add("has-error");
        }
    }

    // Calculation Mode Switcher Logic
    function setCalcMode(mode) {
        currentCalcMode = mode;
        if (mode === "risk") {
            elements.modeRiskSizing.classList.add("active");
            elements.modeCustomLot.classList.remove("active");
            elements.modeRiskSizing.setAttribute("aria-selected", "true");
            elements.modeCustomLot.setAttribute("aria-selected", "false");

            elements.modeRiskGrid.classList.remove("hidden");
            if (elements.riskPresetsBar) elements.riskPresetsBar.classList.remove("hidden");
            elements.riskSummaryBar.classList.remove("hidden");
            elements.modeLotGrid.classList.add("hidden");
            elements.lotPresetsBar.classList.add("hidden");

            elements.riskModeResults.classList.remove("hidden");
            elements.lotModeResults.classList.add("hidden");

            elements.accountSectionTitle.textContent = "Account & risk";
            elements.resultsSectionTitle.textContent = "Results";
            elements.pillRiskLabel.textContent = "SL Loss";

            // Sync balance from lot mode to risk mode
            if (elements.accountBalanceLot.value.trim() !== "") {
                elements.balanceInput.value = elements.accountBalanceLot.value;
            }
        } else {
            elements.modeCustomLot.classList.add("active");
            elements.modeRiskSizing.classList.remove("active");
            elements.modeCustomLot.setAttribute("aria-selected", "true");
            elements.modeRiskSizing.setAttribute("aria-selected", "false");

            elements.modeRiskGrid.classList.add("hidden");
            if (elements.riskPresetsBar) elements.riskPresetsBar.classList.add("hidden");
            elements.riskSummaryBar.classList.add("hidden");
            elements.modeLotGrid.classList.remove("hidden");
            elements.lotPresetsBar.classList.remove("hidden");

            elements.riskModeResults.classList.add("hidden");
            elements.lotModeResults.classList.remove("hidden");

            elements.accountSectionTitle.textContent = "Account & custom lot";
            elements.resultsSectionTitle.textContent = "Results";
            elements.pillRiskLabel.textContent = "SL Loss";

            // Sync balance from risk mode to lot mode
            if (elements.balanceInput.value.trim() !== "") {
                elements.accountBalanceLot.value = elements.balanceInput.value;
            }
        }
        updateSegmentedSlider("calc-mode-segmented");
        recalculate();
    }

    elements.modeRiskSizing.addEventListener("click", () => setCalcMode("risk"));
    elements.modeCustomLot.addEventListener("click", () => setCalcMode("lot"));

    // Quick Lot Presets
    elements.lotPresetButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const lot = btn.dataset.lot;
            elements.customLotInput.value = lot;
            elements.lotPresetButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            recalculate();
        });
    });

    // Custom Lot Size +/- Stepper Logic
    function stepCustomLot(direction) {
        const isBtc = currentInstrumentKey === "BTCUSDT.P";
        const step = isBtc ? 0.001 : 0.01;
        const decimals = isBtc ? 3 : 2;

        let curr = parseFloat(elements.customLotInput.value);
        if (isNaN(curr) || curr <= 0) {
            // Default starting minimum when input is blank:
            // BTCUSDT starts from 0.001, XAUUSD starts from 0.01
            curr = isBtc ? 0.001 : 0.01;
            if (direction < 0) curr = step;
        } else {
            curr = Number((curr + direction * step).toFixed(decimals));
            if (curr < step) curr = step;
        }

        elements.customLotInput.value = curr.toFixed(decimals);

        // Sync active state on preset buttons
        elements.lotPresetButtons.forEach(btn => {
            const presetVal = parseFloat(btn.dataset.lot);
            if (Math.abs(presetVal - curr) < 1e-5) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });

        recalculate();
    }

    if (elements.btnLotPlus) {
        elements.btnLotPlus.addEventListener("click", () => stepCustomLot(1));
    }
    if (elements.btnLotMinus) {
        elements.btnLotMinus.addEventListener("click", () => stepCustomLot(-1));
    }

    elements.customLotInput.addEventListener("input", () => {
        const curr = parseFloat(elements.customLotInput.value);
        elements.lotPresetButtons.forEach(btn => {
            const presetVal = parseFloat(btn.dataset.lot);
            if (!isNaN(curr) && Math.abs(presetVal - curr) < 1e-5) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    });

    // Sync Balances
    elements.balanceInput.addEventListener("input", () => {
        elements.accountBalanceLot.value = elements.balanceInput.value;
    });
    elements.accountBalanceLot.addEventListener("input", () => {
        elements.balanceInput.value = elements.accountBalanceLot.value;
    });

    // Switch Instrument
    function setInstrument(symbolKey) {
        if (!INSTRUMENTS[symbolKey]) return;
        currentInstrumentKey = symbolKey;
        const spec = INSTRUMENTS[symbolKey];

        if (elements.appTitle) elements.appTitle.textContent = "Position Size Calculator";
        if (elements.appSubtitle) elements.appSubtitle.textContent = spec.subtitle || "";

        if (symbolKey === "XAUUSD") {
            elements.btnXauusd.classList.add("active");
            elements.btnBtcusdt.classList.remove("active");
            elements.btnXauusd.setAttribute("aria-selected", "true");
            elements.btnBtcusdt.setAttribute("aria-selected", "false");
            
            // Show XAU section, Hide Crypto sections
            elements.xauSlSection.classList.remove("hidden");
            elements.cryptoPositionSection.classList.add("hidden");
            elements.cryptoPosMetrics.classList.add("hidden");
            elements.cryptoLeverageSection.classList.add("hidden");
            
            elements.lotUsdFooter.textContent = "USD · 0.01 · 100 oz";
            elements.lotBybitFooter.textContent = "USDT · 0.001 · 100 oz";
            if (elements.lotUscBadge) elements.lotUscBadge.innerHTML = "<span class='badge-symbol'>¢</span> USC (1 oz/lot)";
            elements.lotUscCentHint.textContent = "USC · 0.01 · 1 oz";
            elements.customLotSuffix.textContent = "Lots";
            if (elements.lotStepIndicator) elements.lotStepIndicator.textContent = "Step: 0.01";
            if (elements.customLotInput) elements.customLotInput.placeholder = "e.g. 0.05";
            if (elements.trustAssumptionText) elements.trustAssumptionText.textContent = "1 pip = $0.10 · 1 lot = 100 oz";
            closeLeverageMenu();
        } else {
            elements.btnBtcusdt.classList.add("active");
            elements.btnXauusd.classList.remove("active");
            elements.btnBtcusdt.setAttribute("aria-selected", "true");
            elements.btnXauusd.setAttribute("aria-selected", "false");
            
            // Hide XAU section, Show Crypto sections
            elements.xauSlSection.classList.add("hidden");
            elements.cryptoPositionSection.classList.remove("hidden");
            elements.cryptoPosMetrics.classList.remove("hidden");
            elements.cryptoLeverageSection.classList.remove("hidden");
            
            elements.lotUsdFooter.textContent = "USD · 0.01 · 1 BTC";
            elements.lotBybitFooter.textContent = "USDT · 0.001 · 1 BTC";
            if (elements.lotUscBadge) elements.lotUscBadge.innerHTML = "<span class='badge-symbol'>¢</span> USC (1 Lot = 0.01 BTC)";
            elements.lotUscCentHint.textContent = "USC · 0.01 · 0.01 BTC";
            elements.customLotSuffix.textContent = "BTC";
            if (elements.lotStepIndicator) elements.lotStepIndicator.textContent = "Step: 0.001";
            if (elements.customLotInput) elements.customLotInput.placeholder = "e.g. 0.010";
            if (elements.trustAssumptionText) elements.trustAssumptionText.textContent = "1 pip = $1.00 · 1 lot = 1 BTC";
        }

        syncAllSegmentedSliders();
        setTimeout(syncAllSegmentedSliders, 30);
        recalculate();
    }

    elements.btnXauusd.addEventListener("click", () => setInstrument("XAUUSD"));
    elements.btnBtcusdt.addEventListener("click", () => setInstrument("BTCUSDT.P"));

    // XAU Mode Switching (SL Pips vs 差价 $ vs Entry / SL)
    function setXauMode(mode) {
        activeXauSlMode = mode;
        if (mode === "pips") {
            elements.tabPips.classList.add("active");
            elements.tabXauDiff.classList.remove("active");
            elements.tabPrice.classList.remove("active");
            elements.tabPips.setAttribute("aria-selected", "true");
            elements.tabXauDiff.setAttribute("aria-selected", "false");
            elements.tabPrice.setAttribute("aria-selected", "false");
            elements.pipsSection.classList.remove("hidden");
            elements.xauDiffSection.classList.add("hidden");
            elements.priceSection.classList.add("hidden");
        } else if (mode === "diff") {
            elements.tabXauDiff.classList.add("active");
            elements.tabPips.classList.remove("active");
            elements.tabPrice.classList.remove("active");
            elements.tabXauDiff.setAttribute("aria-selected", "true");
            elements.tabPips.setAttribute("aria-selected", "false");
            elements.tabPrice.setAttribute("aria-selected", "false");
            elements.xauDiffSection.classList.remove("hidden");
            elements.pipsSection.classList.add("hidden");
            elements.priceSection.classList.add("hidden");
            
            // Auto sync from pips if diff is empty
            const pips = parseFloat(elements.slPipsInput.value);
            if (!isNaN(pips) && pips > 0 && elements.xauSlDiffInput.value === "") {
                elements.xauSlDiffInput.value = (pips * 0.10).toFixed(2);
            }
        } else {
            elements.tabPrice.classList.add("active");
            elements.tabPips.classList.remove("active");
            elements.tabXauDiff.classList.remove("active");
            elements.tabPrice.setAttribute("aria-selected", "true");
            elements.tabPips.setAttribute("aria-selected", "false");
            elements.tabXauDiff.setAttribute("aria-selected", "false");
            elements.priceSection.classList.remove("hidden");
            elements.pipsSection.classList.add("hidden");
            elements.xauDiffSection.classList.add("hidden");
        }
        updateSegmentedSlider("xau-sl-segmented");
        recalculate();
    }

    elements.tabPips.addEventListener("click", () => setXauMode("pips"));
    elements.tabXauDiff.addEventListener("click", () => setXauMode("diff"));
    elements.tabPrice.addEventListener("click", () => setXauMode("price"));

    // BTC 3-Way SL Mode Switching (Price / 差价 / 比例%)
    function setBtcSlMode(mode) {
        activeBtcSlMode = mode;
        const buttons = [
            { key: "price", btn: elements.btcModePrice, group: elements.cryptoSlPriceGroup },
            { key: "diff", btn: elements.btcModeDiff, group: elements.cryptoSlDiffGroup },
            { key: "pct", btn: elements.btcModePct, group: elements.cryptoSlPctGroup }
        ];

        buttons.forEach(item => {
            if (item.key === mode) {
                item.btn.classList.add("active");
                item.btn.setAttribute("aria-selected", "true");
                item.group.classList.remove("hidden");
            } else {
                item.btn.classList.remove("active");
                item.btn.setAttribute("aria-selected", "false");
                item.group.classList.add("hidden");
            }
        });

        updateSegmentedSlider("btc-sl-segmented");
        recalculate();
    }

    elements.btcModePrice.addEventListener("click", () => setBtcSlMode("price"));
    elements.btcModeDiff.addEventListener("click", () => setBtcSlMode("diff"));
    elements.btcModePct.addEventListener("click", () => setBtcSlMode("pct"));

    // Crypto Long / Short Switcher
    elements.sideLong.addEventListener("click", () => {
        cryptoTradeSide = "long";
        elements.sideLong.classList.add("active");
        elements.sideShort.classList.remove("active");
        elements.sideLong.setAttribute("aria-selected", "true");
        elements.sideShort.setAttribute("aria-selected", "false");
        updateSegmentedSlider("crypto-side-segmented");
        recalculate();
    });

    elements.sideShort.addEventListener("click", () => {
        cryptoTradeSide = "short";
        elements.sideShort.classList.add("active");
        elements.sideLong.classList.remove("active");
        elements.sideShort.setAttribute("aria-selected", "true");
        elements.sideLong.setAttribute("aria-selected", "false");
        updateSegmentedSlider("crypto-side-segmented");
        recalculate();
    });

    // Expandable Leverage Dropdown Menu
    function toggleLeverageMenu() {
        const isOpen = !elements.leverageMenu.classList.contains("hidden");
        if (isOpen) closeLeverageMenu();
        else openLeverageMenu();
    }

    function openLeverageMenu() {
        elements.leverageMenu.classList.remove("hidden");
        elements.leverageTriggerBtn.setAttribute("aria-expanded", "true");
    }

    function closeLeverageMenu() {
        elements.leverageMenu.classList.add("hidden");
        elements.leverageTriggerBtn.setAttribute("aria-expanded", "false");
    }

    elements.leverageTriggerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleLeverageMenu();
    });

    elements.leverageMenu.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => {
        if (!elements.leverageMenu.classList.contains("hidden")) closeLeverageMenu();
    });

    // Leverage Selection Logic
    function applyLeverageSelection(lev, isAuto = false) {
        if (isAuto) {
            isAutoSafeLeverage = true;
            elements.levMenuButtons.forEach(btn => btn.classList.remove("active"));
            elements.btnMenuAutoSafe.classList.add("active");
        } else {
            isAutoSafeLeverage = false;
            if (isNaN(lev) || lev < 1) lev = 1;
            if (lev > 150) lev = 150;
            manualLeverage = lev;
            elements.leverageCustomInput.value = lev;

            elements.levMenuButtons.forEach(btn => {
                if (parseInt(btn.dataset.lev, 10) === lev) btn.classList.add("active");
                else btn.classList.remove("active");
            });
        }
        recalculate();
    }

    elements.levMenuButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            if (btn.dataset.lev === "auto") {
                applyLeverageSelection(null, true);
            } else {
                applyLeverageSelection(parseInt(btn.dataset.lev, 10), false);
            }
            closeLeverageMenu();
        });
    });

    elements.leverageCustomInput.addEventListener("input", () => {
        const val = parseInt(elements.leverageCustomInput.value, 10);
        if (!isNaN(val) && val >= 1 && val <= 150) {
            applyLeverageSelection(val, false);
        }
    });

    // Validation
    function validateInputs() {
        const balanceInputEl = currentCalcMode === "risk" ? elements.balanceInput : elements.accountBalanceLot;
        const balanceStr = balanceInputEl.value.trim();

        if (balanceStr === "") {
            return { isWaiting: true, isValid: false, message: "" };
        }

        const balance = parseFloat(balanceStr);
        if (isNaN(balance) || balance <= 0) {
            return { isWaiting: false, isValid: false, message: "Enter a valid account balance." };
        }

        if (currentCalcMode === "risk") {
            const riskStr = elements.riskInput.value.trim();
            if (riskStr === "") return { isWaiting: true, isValid: false, message: "" };
            const risk = parseFloat(riskStr);
            if (isNaN(risk) || risk <= 0) {
                return { isWaiting: false, isValid: false, message: "Enter a valid risk percentage." };
            }
        } else {
            const customLotStr = elements.customLotInput.value.trim();
            if (customLotStr === "") return { isWaiting: true, isValid: false, message: "" };
            const customLot = parseFloat(customLotStr);
            if (isNaN(customLot) || customLot <= 0) {
                return { isWaiting: false, isValid: false, message: "Enter a valid custom lot size (> 0)." };
            }
        }

        if (currentInstrumentKey === "XAUUSD") {
            if (activeXauSlMode === "pips") {
                const pipsStr = elements.slPipsInput.value.trim();
                if (pipsStr === "") return { isWaiting: true, isValid: false, message: "" };
                const pips = parseFloat(pipsStr);
                if (isNaN(pips) || pips <= 0) {
                    return { isWaiting: false, isValid: false, message: "Enter a valid stop loss in pips." };
                }
            } else if (activeXauSlMode === "diff") {
                const diffStr = elements.xauSlDiffInput.value.trim();
                if (diffStr === "") return { isWaiting: true, isValid: false, message: "" };
                const diff = parseFloat(diffStr);
                if (isNaN(diff) || diff <= 0) {
                    return { isWaiting: false, isValid: false, message: "Enter a valid SL price difference ($)." };
                }
            } else {
                const entryStr = elements.xauEntryPriceInput.value.trim();
                const slStr = elements.xauSlPriceInput.value.trim();
                if (entryStr === "" || slStr === "") return { isWaiting: true, isValid: false, message: "" };
                const entry = parseFloat(entryStr);
                const sl = parseFloat(slStr);
                if (isNaN(entry) || entry <= 0) {
                    return { isWaiting: false, isValid: false, message: "Enter a valid entry price." };
                }
                if (isNaN(sl) || sl <= 0) {
                    return { isWaiting: false, isValid: false, message: "Enter a valid stop loss price." };
                }
                if (Math.abs(entry - sl) < 0.0001) {
                    return { isWaiting: false, isValid: false, message: "Entry and Stop Loss prices cannot be identical." };
                }
            }
        } else {
            const entryStr = elements.cryptoEntryPriceInput.value.trim();
            if (entryStr === "") return { isWaiting: true, isValid: false, message: "" };
            const entry = parseFloat(entryStr);
            if (isNaN(entry) || entry <= 0) {
                return { isWaiting: false, isValid: false, message: "Enter a valid entry price." };
            }

            if (activeBtcSlMode === "price") {
                const slStr = elements.cryptoSlPriceInput.value.trim();
                if (slStr === "") return { isWaiting: true, isValid: false, message: "" };
                const sl = parseFloat(slStr);
                if (isNaN(sl) || sl <= 0) {
                    return { isWaiting: false, isValid: false, message: "Enter a valid stop loss price." };
                }
                if (Math.abs(entry - sl) < 0.0001) {
                    return { isWaiting: false, isValid: false, message: "Entry and Stop Loss prices cannot be identical." };
                }
            } else if (activeBtcSlMode === "diff") {
                const diffStr = elements.cryptoSlDiffInput.value.trim();
                if (diffStr === "") return { isWaiting: true, isValid: false, message: "" };
                const diff = parseFloat(diffStr);
                if (isNaN(diff) || diff <= 0) {
                    return { isWaiting: false, isValid: false, message: "Enter a valid SL price difference ($)." };
                }
            } else if (activeBtcSlMode === "pct") {
                const pctStr = elements.cryptoSlPctInput.value.trim();
                if (pctStr === "") return { isWaiting: true, isValid: false, message: "" };
                const pct = parseFloat(pctStr);
                if (isNaN(pct) || pct <= 0 || pct >= 100) {
                    return { isWaiting: false, isValid: false, message: "Enter a valid SL percentage (0 < % < 100)." };
                }
            }
        }

        return { isWaiting: false, isValid: true, message: "" };
    }

    // Main Recalculate
    function recalculate() {
        const validation = validateInputs();
        const spec = INSTRUMENTS[currentInstrumentKey];

        const balanceInputEl = currentCalcMode === "risk" ? elements.balanceInput : elements.accountBalanceLot;
        const balanceStr = balanceInputEl.value.trim();
        const balance = parseFloat(balanceStr);

        if (currentCalcMode === "risk") {
            const riskStr = elements.riskInput.value.trim();
            const riskPercent = parseFloat(riskStr);
            if (!isNaN(balance) && balance > 0 && !isNaN(riskPercent) && riskPercent > 0) {
                const riskAmount = Calculator.calculateRiskAmount(balance, riskPercent);
                elements.displayRiskAmount.textContent = `$${riskAmount.toFixed(2)}`;
            } else {
                elements.displayRiskAmount.textContent = "—";
            }
        }

        if (!validation.isValid) {
            if (validation.isWaiting) {
                clearInputErrors();
                elements.validationError.textContent = "";
                elements.validationError.classList.add("hidden");
                if (elements.resultsEmptyHint) {
                    elements.resultsEmptyHint.textContent = "Enter account equity to see lot sizes";
                    elements.resultsEmptyHint.style.display = "block";
                }
            } else {
                highlightErrorInput(validation.message);
                elements.validationError.textContent = validation.message;
                elements.validationError.classList.remove("hidden");
                if (elements.resultsEmptyHint) {
                    elements.resultsEmptyHint.textContent = validation.message;
                    elements.resultsEmptyHint.style.display = "block";
                }
            }
            
            if (elements.displayPriceDistance) elements.displayPriceDistance.textContent = "—";
            if (elements.displayCryptoSlDist) elements.displayCryptoSlDist.textContent = "—";
            
            // Clear Risk Mode Lot cards
            elements.lotUsdVal.textContent = "—";
            elements.lotUsdVal.classList.add("text-empty");
            elements.lotUsdVal.classList.remove("lot-zero");
            elements.lotUscVal.textContent = "—";
            elements.lotUscVal.classList.add("text-empty");
            elements.lotUscVal.classList.remove("lot-zero");
            elements.lotBybitVal.textContent = "—";
            elements.lotBybitVal.classList.add("text-empty");
            elements.lotBybitVal.classList.remove("lot-zero");
            
            // Clear Lot Mode PnL cards
            if (elements.pnlTpVal) {
                elements.pnlTpVal.textContent = "—";
                elements.pnlTpVal.classList.add("text-empty");
            }
            if (elements.pnlTpFooter) elements.pnlTpFooter.textContent = "—";
            if (elements.pnlSlVal) {
                elements.pnlSlVal.textContent = "—";
                elements.pnlSlVal.classList.add("text-empty");
            }
            if (elements.pnlSlFooter) elements.pnlSlFooter.textContent = "—";
            if (elements.pnlRrVal) {
                elements.pnlRrVal.textContent = "—";
                elements.pnlRrVal.classList.add("text-empty");
            }
            if (elements.pnlRrFooter) elements.pnlRrFooter.textContent = "—";

            if (elements.displayPosVal) elements.displayPosVal.textContent = "—";
            if (elements.displayActualRisk) elements.displayActualRisk.textContent = "—";
            if (elements.cryptoSafeLevBadge) elements.cryptoSafeLevBadge.textContent = "—";
            if (elements.cryptoEffectiveLev) elements.cryptoEffectiveLev.textContent = "—";
            if (elements.cryptoMargin) elements.cryptoMargin.textContent = "—";
            if (elements.cryptoLiqPrice) elements.cryptoLiqPrice.textContent = "—";
            if (elements.cryptoLiqBuffer) elements.cryptoLiqBuffer.textContent = "—";
            if (elements.cryptoSlLoss) elements.cryptoSlLoss.textContent = "—";
            if (elements.levDangerBanner) elements.levDangerBanner.classList.add("hidden");
            if (elements.matrixTbody) {
                elements.matrixTbody.innerHTML = `<tr><td colspan='5' style='text-align:center; color: var(--text-secondary); padding: 16px 0; font-size: 14px;'>Enter entry and stop loss to compare leverage levels</td></tr>`;
            }
            if (elements.mobileStickyLot) elements.mobileStickyLot.textContent = "—";
            if (elements.mobileStickyRisk) elements.mobileStickyRisk.textContent = "—";
            return;
        }

        clearInputErrors();
        elements.validationError.textContent = "";
        elements.validationError.classList.add("hidden");
        if (elements.resultsEmptyHint) {
            elements.resultsEmptyHint.style.display = "none";
        }

        let priceDistance = 0;
        let entryPrice = 0;
        let slPrice = 0;
        let tpPrice = 0;

        if (currentInstrumentKey === "XAUUSD") {
            // XAUUSD Calculation (3 SL Modes: Pips / 差价 $ / Entry-SL)
            if (activeXauSlMode === "pips") {
                const pips = parseFloat(elements.slPipsInput.value);
                priceDistance = pips * spec.pipSize;
                elements.displayPriceDistance.textContent = `$${priceDistance.toFixed(2)} (${pips.toFixed(1)} pips)`;
            } else if (activeXauSlMode === "diff") {
                priceDistance = parseFloat(elements.xauSlDiffInput.value);
                const pips = priceDistance / spec.pipSize;
                elements.displayPriceDistance.textContent = `$${priceDistance.toFixed(2)} (${pips.toFixed(1)} pips)`;
            } else {
                entryPrice = parseFloat(elements.xauEntryPriceInput.value);
                slPrice = parseFloat(elements.xauSlPriceInput.value);
                priceDistance = Math.abs(entryPrice - slPrice);
                const pips = priceDistance / spec.pipSize;
                elements.displayPriceDistance.textContent = `$${priceDistance.toFixed(2)} (${pips.toFixed(1)} pips)`;
            }
        } else {
            // BTCUSDT Calculation (3 SL Modes: Price / 差价 $ / 比例 %)
            entryPrice = parseFloat(elements.cryptoEntryPriceInput.value);

            if (activeBtcSlMode === "price") {
                slPrice = parseFloat(elements.cryptoSlPriceInput.value);
                priceDistance = Math.abs(entryPrice - slPrice);
            } else if (activeBtcSlMode === "diff") {
                priceDistance = parseFloat(elements.cryptoSlDiffInput.value);
                slPrice = cryptoTradeSide === "long" ? entryPrice - priceDistance : entryPrice + priceDistance;
                if (slPrice < 0) slPrice = 0;
            } else if (activeBtcSlMode === "pct") {
                const pct = parseFloat(elements.cryptoSlPctInput.value);
                priceDistance = entryPrice * (pct / 100);
                slPrice = cryptoTradeSide === "long" ? entryPrice - priceDistance : entryPrice + priceDistance;
                if (slPrice < 0) slPrice = 0;
            }

            const slPct = (priceDistance / entryPrice) * 100;
            elements.displayCryptoSlDist.textContent = `SL: $${slPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | 差价: $${priceDistance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${slPct.toFixed(2)}%)`;

            const tpStr = elements.cryptoTpPriceInput.value.trim();
            if (tpStr !== "") {
                const parsedTp = parseFloat(tpStr);
                if (!isNaN(parsedTp) && parsedTp > 0) {
                    tpPrice = parsedTp;
                }
            }
        }

        let activeCalcLot = 0;
        let actualRiskAmount = 0;

        if (currentCalcMode === "risk") {
            // Mode 1: Risk-Sizing Reverse-Deduction
            const riskPercent = parseFloat(elements.riskInput.value);
            const riskAmount = Calculator.calculateRiskAmount(balance, riskPercent);

            if (currentInstrumentKey === "XAUUSD") {
                // XAUUSD:
                // 1. MT5 USD Account: Contract Size = 100 oz per 1 lot, Step 0.01
                const exactUsdLot = Calculator.calculateExactLot(riskAmount, priceDistance, 100);
                let usdLot = 0;
                if (exactUsdLot < 0.01) {
                    elements.lotUsdVal.textContent = "0.00";
                    elements.lotUsdVal.classList.add("lot-zero");
                } else {
                    usdLot = Calculator.calculateLotSize(exactUsdLot, 0.01);
                    elements.lotUsdVal.textContent = usdLot.toFixed(2);
                    elements.lotUsdVal.classList.remove("lot-zero");
                }
                elements.lotUsdVal.classList.remove("text-empty");
                triggerValAnimation(elements.lotUsdVal);

                // 2. MT5 USC Cent Account: Contract Size = 1 oz per 1 USC lot, Step 0.01
                const exactUscLot = Calculator.calculateExactLot(riskAmount, priceDistance, 1);
                let uscLot = 0;
                if (exactUscLot < 0.01) {
                    elements.lotUscVal.textContent = "0.00";
                    elements.lotUscVal.classList.add("lot-zero");
                } else {
                    uscLot = Calculator.calculateLotSize(exactUscLot, 0.01);
                    elements.lotUscVal.textContent = uscLot.toFixed(2);
                    elements.lotUscVal.classList.remove("lot-zero");
                }
                elements.lotUscVal.classList.remove("text-empty");
                triggerValAnimation(elements.lotUscVal);

                // 3. Bybit / Crypto Account: Contract Size = 100 oz per 1 lot, Step 0.001
                const exactBybitLot = Calculator.calculateExactLot(riskAmount, priceDistance, 100);
                let bybitLot = 0;
                if (exactBybitLot < 0.001) {
                    elements.lotBybitVal.textContent = "0.000";
                    elements.lotBybitVal.classList.add("lot-zero");
                } else {
                    bybitLot = Calculator.calculateLotSize(exactBybitLot, 0.001);
                    elements.lotBybitVal.textContent = bybitLot.toFixed(3);
                    elements.lotBybitVal.classList.remove("lot-zero");
                }
                elements.lotBybitVal.classList.remove("text-empty");
                triggerValAnimation(elements.lotBybitVal);

                activeCalcLot = usdLot > 0 ? usdLot : (bybitLot > 0 ? bybitLot : exactUsdLot);
                actualRiskAmount = activeCalcLot * priceDistance * 100;
            } else {
                // BTCUSDT:
                // 1. MT5 USD Account: Contract Size = 1 BTC per 1 lot, Step 0.01
                const exactBtcLot = Calculator.calculateExactLot(riskAmount, priceDistance, 1);
                let usdLot = 0;
                if (exactBtcLot < 0.01) {
                    elements.lotUsdVal.textContent = "0.00";
                    elements.lotUsdVal.classList.add("lot-zero");
                } else {
                    usdLot = Calculator.calculateLotSize(exactBtcLot, 0.01);
                    elements.lotUsdVal.textContent = usdLot.toFixed(2);
                    elements.lotUsdVal.classList.remove("lot-zero");
                }
                elements.lotUsdVal.classList.remove("text-empty");
                triggerValAnimation(elements.lotUsdVal);

                // 2. USC Cent Account: Contract Size = 0.01 BTC per 1 USC lot, Step 0.01
                const exactUscBtcLot = exactBtcLot * 100;
                let uscLot = 0;
                if (exactUscBtcLot < 0.01) {
                    elements.lotUscVal.textContent = "0.00";
                    elements.lotUscVal.classList.add("lot-zero");
                } else {
                    uscLot = Calculator.calculateLotSize(exactUscBtcLot, 0.01);
                    elements.lotUscVal.textContent = uscLot.toFixed(2);
                    elements.lotUscVal.classList.remove("lot-zero");
                }
                elements.lotUscVal.classList.remove("text-empty");
                triggerValAnimation(elements.lotUscVal);

                // 3. Bybit Account: Contract Size = 1 BTC per 1 lot, Step 0.001
                let bybitLot = 0;
                if (exactBtcLot < 0.001) {
                    elements.lotBybitVal.textContent = "0.000";
                    elements.lotBybitVal.classList.add("lot-zero");
                } else {
                    bybitLot = Calculator.calculateLotSize(exactBtcLot, 0.001);
                    elements.lotBybitVal.textContent = bybitLot.toFixed(3);
                    elements.lotBybitVal.classList.remove("lot-zero");
                }
                elements.lotBybitVal.classList.remove("text-empty");
                triggerValAnimation(elements.lotBybitVal);

                activeCalcLot = usdLot > 0 ? usdLot : (bybitLot > 0 ? bybitLot : exactBtcLot);
                actualRiskAmount = activeCalcLot * priceDistance * 1;
            }
        } else {
            // Mode 2: Custom Lot Size Sizing & PnL
            const customLot = parseFloat(elements.customLotInput.value);
            activeCalcLot = customLot;
            const currentContractSize = spec.contractSize; // 100 for XAUUSD, 1 for BTCUSDT
            
            actualRiskAmount = activeCalcLot * priceDistance * currentContractSize;
            const slLossPct = (actualRiskAmount / balance) * 100;

            // Update SL Card
            elements.pnlSlVal.textContent = `-$${actualRiskAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            elements.pnlSlVal.classList.remove("text-empty");
            triggerValAnimation(elements.pnlSlVal);
            elements.pnlSlFooter.textContent = `-${slLossPct.toFixed(2)}% of Account Equity`;

            // Update TP & R:R Card
            if (tpPrice > 0) {
                const tpDistance = Math.abs(tpPrice - entryPrice);
                const tpProfit = activeCalcLot * tpDistance * currentContractSize;
                const tpProfitPct = (tpProfit / balance) * 100;
                const rrRatio = priceDistance > 0 ? (tpDistance / priceDistance) : 0;

                elements.pnlTpVal.textContent = `+$${tpProfit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                elements.pnlTpVal.classList.remove("text-empty");
                triggerValAnimation(elements.pnlTpVal);
                elements.pnlTpFooter.textContent = `+${tpProfitPct.toFixed(2)}% Equity Growth`;

                elements.pnlRrVal.textContent = `1 : ${rrRatio.toFixed(2)}`;
                elements.pnlRrVal.classList.remove("text-empty");
                triggerValAnimation(elements.pnlRrVal);
                elements.pnlRrFooter.textContent = rrRatio >= 2 ? "Favorable R:R (> 1:2)" : (rrRatio >= 1 ? "Balanced R:R" : "Low R:R (< 1:1)");
            } else {
                elements.pnlTpVal.textContent = "—";
                elements.pnlTpVal.classList.add("text-empty");
                elements.pnlTpFooter.textContent = "Take profit target";
                elements.pnlRrVal.textContent = "—";
                elements.pnlRrVal.classList.add("text-empty");
                elements.pnlRrFooter.textContent = "Profile ratio";
            }
        }

        // Reverse-Deduction Engine for Crypto (BTCUSDT)
        if (spec.isCrypto && entryPrice > 0) {
            const positionValue = activeCalcLot * entryPrice * spec.contractSize;
            const actualRiskPct = (actualRiskAmount / balance) * 100;

            elements.displayPosVal.textContent = `$${positionValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            elements.displayActualRisk.textContent = `$${actualRiskAmount.toFixed(2)} (${actualRiskPct.toFixed(2)}%)`;

            // 1. Calculate Max Safe Leverage
            calculatedMaxSafeLeverage = Calculator.calculateMaxSafeLeverage(entryPrice, slPrice);
            elements.cryptoSafeLevBadge.textContent = `${calculatedMaxSafeLeverage}x`;
            elements.dangerSuggestLev.textContent = `${calculatedMaxSafeLeverage}x`;

            // Active Leverage (Auto-Safe or Manual Override)
            const currentActiveLev = isAutoSafeLeverage ? calculatedMaxSafeLeverage : manualLeverage;
            
            if (isAutoSafeLeverage) {
                elements.leverageDisplayText.textContent = `${calculatedMaxSafeLeverage}x (Auto Safe)`;
                elements.leverageCustomInput.value = calculatedMaxSafeLeverage;
            } else {
                elements.leverageDisplayText.textContent = `${manualLeverage}x`;
                elements.leverageCustomInput.value = manualLeverage;
            }

            // Danger check
            if (currentActiveLev > calculatedMaxSafeLeverage) {
                elements.levDangerBanner.classList.remove("hidden");
            } else {
                elements.levDangerBanner.classList.add("hidden");
            }

            // 2. Reverse-Deduce Effective Leverage (真实账户有效杠杆 = Position Value / Equity)
            const effectiveLev = (positionValue / balance);
            elements.cryptoEffectiveLev.textContent = `${effectiveLev.toFixed(2)}x`;

            // 3. Required Margin at Current Leverage
            const requiredMargin = positionValue / currentActiveLev;
            const marginUsagePct = (requiredMargin / balance) * 100;
            elements.cryptoMargin.textContent = `$${requiredMargin.toFixed(2)} (${marginUsagePct.toFixed(1)}%)`;

            // 4. Estimated Liquidation Price & Buffer
            const estLiqPrice = Calculator.calculateLiqPrice(entryPrice, currentActiveLev, cryptoTradeSide);
            elements.cryptoLiqPrice.textContent = `$${estLiqPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            let liqBuffer = 0;
            if (cryptoTradeSide === "long") {
                liqBuffer = slPrice - estLiqPrice;
            } else {
                liqBuffer = estLiqPrice - slPrice;
            }
            const isSafe = (liqBuffer >= -0.01);

            if (isSafe) {
                const bufferText = liqBuffer > 0 ? `+$${liqBuffer.toFixed(2)}` : `~$0.00`;
                elements.cryptoLiqBuffer.textContent = bufferText;
                elements.cryptoLiqBuffer.className = "metric-val text-green";
            } else {
                elements.cryptoLiqBuffer.textContent = `-$${Math.abs(liqBuffer).toFixed(2)}`;
                elements.cryptoLiqBuffer.className = "metric-val text-red";
            }
            if (elements.cryptoLiqDot) {
                elements.cryptoLiqDot.className = isSafe ? "status-dot dot-profit" : "status-dot dot-loss";
            }

            const slRoe = requiredMargin > 0 ? (actualRiskAmount / requiredMargin) * 100 : 0;
            elements.cryptoSlLoss.textContent = `-$${actualRiskAmount.toFixed(2)} (-${slRoe.toFixed(1)}% ROE)`;

            // 5. Render Multi-Leverage Comparison Matrix Table
            const leverageTiers = [1, 5, 10, 20, 25, 50, 100, 150];
            if (!leverageTiers.includes(currentActiveLev)) {
                leverageTiers.push(currentActiveLev);
            }
            if (!leverageTiers.includes(calculatedMaxSafeLeverage)) {
                leverageTiers.push(calculatedMaxSafeLeverage);
            }
            leverageTiers.sort((a, b) => a - b);

            let matrixHtml = "";
            leverageTiers.forEach(lev => {
                const margin = positionValue / lev;
                const usagePct = (margin / balance) * 100;
                const liq = Calculator.calculateLiqPrice(entryPrice, lev, cryptoTradeSide);
                
                let buffer = 0;
                if (cryptoTradeSide === "long") {
                    buffer = slPrice - liq;
                } else {
                    buffer = liq - slPrice;
                }
                const rowSafe = (buffer >= -0.01);

                const isActive = (lev === currentActiveLev);
                const isOptimalSafe = (lev === calculatedMaxSafeLeverage);
                const activeClass = isActive ? "class='active-row'" : "";
                const optimalBadge = isOptimalSafe ? " <span style='font-size:10px; color:var(--color-brand); font-weight:600;'>[Safe]</span>" : "";
                
                const bufferBadge = rowSafe 
                    ? `<span class='badge-safe'>${buffer > 0 ? '+$' + buffer.toFixed(0) : '~$0'}</span>`
                    : `<span class='badge-danger'>-$${Math.abs(buffer).toFixed(0)} Liq</span>`;

                matrixHtml += `
                    <tr ${activeClass}>
                        <td><b>${lev}x</b>${optimalBadge}</td>
                        <td>$${margin.toFixed(2)}</td>
                        <td>${usagePct.toFixed(1)}%</td>
                        <td>$${liq.toFixed(1)}</td>
                        <td>${bufferBadge}</td>
                    </tr>
                `;
            });

            elements.matrixTbody.innerHTML = matrixHtml;
        }

        // Update Mobile Floating Sticky Result Bar
        if (elements.mobileStickyLot) {
            if (currentCalcMode === "risk") {
                const stdLot = elements.lotUsdVal ? elements.lotUsdVal.textContent.trim() : "—";
                const bybitLot = elements.lotBybitVal ? elements.lotBybitVal.textContent.trim() : "—";
                const activeLot = (stdLot !== "—" && stdLot !== "0.00") ? stdLot : (bybitLot !== "—" ? bybitLot : stdLot);

                if (elements.mobileStickyName) {
                    elements.mobileStickyName.textContent = currentInstrumentKey === "XAUUSD" ? "MT5 Standard" : "Bybit / MT5";
                }
                elements.mobileStickyLot.textContent = activeLot;
                if (elements.mobileStickyUnit) elements.mobileStickyUnit.textContent = "Lots";
                
                const riskPct = balance > 0 ? ((actualRiskAmount / balance) * 100).toFixed(2) : "0.00";
                if (elements.mobileStickyRisk) {
                    elements.mobileStickyRisk.textContent = `$${actualRiskAmount.toFixed(2)} (${riskPct}%)`;
                }
            } else {
                if (elements.mobileStickyName) elements.mobileStickyName.textContent = "Custom Lot";
                elements.mobileStickyLot.textContent = (elements.customLotInput && elements.customLotInput.value) ? elements.customLotInput.value : "—";
                if (elements.mobileStickyUnit) elements.mobileStickyUnit.textContent = spec.isCrypto ? "BTC" : "Lots";
                const riskPct = balance > 0 ? ((actualRiskAmount / balance) * 100).toFixed(2) : "0.00";
                if (elements.mobileStickyRisk) {
                    elements.mobileStickyRisk.textContent = `-$${actualRiskAmount.toFixed(2)} (${riskPct}%)`;
                }
            }
        }
    }

    // Theme Switcher (SVG Icons, Zero Emojis)
    const SVG_MOON = `<svg class="theme-icon-svg" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    const SVG_SUN = `<svg class="theme-icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;

    function applyTheme(theme) {
        if (theme === "dark") {
            document.documentElement.setAttribute("data-theme", "dark");
            if (elements.themeToggleBtn) {
                elements.themeToggleBtn.innerHTML = SVG_SUN;
                elements.themeToggleBtn.setAttribute("title", "Switch to light theme");
                elements.themeToggleBtn.setAttribute("aria-label", "Switch to light theme");
            }
        } else {
            document.documentElement.removeAttribute("data-theme");
            if (elements.themeToggleBtn) {
                elements.themeToggleBtn.innerHTML = SVG_MOON;
                elements.themeToggleBtn.setAttribute("title", "Switch to dark theme");
                elements.themeToggleBtn.setAttribute("aria-label", "Switch to dark theme");
            }
        }
        try {
            localStorage.setItem("calc_theme", theme);
        } catch (e) {
            // ignore storage errors
        }
    }

    if (elements.themeToggleBtn) {
        elements.themeToggleBtn.addEventListener("click", () => {
            const isDark = document.documentElement.getAttribute("data-theme") === "dark";
            applyTheme(isDark ? "light" : "dark");
        });
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

    // Collapsible Safe Leverage & Margin
    if (elements.leverageCollapseTrigger && elements.leverageCollapseDrawer) {
        elements.leverageCollapseTrigger.addEventListener("click", () => {
            const isExpanded = elements.leverageCollapseTrigger.getAttribute("aria-expanded") === "true";
            elements.leverageCollapseTrigger.setAttribute("aria-expanded", !isExpanded);
            elements.leverageCollapseDrawer.classList.toggle("expanded", !isExpanded);
            setTimeout(syncAllSegmentedSliders, 220);
        });
    }

    // Trust Formula Disclosure Drawer
    if (elements.btnToggleFormula && elements.formulaDrawer) {
        elements.btnToggleFormula.addEventListener("click", () => {
            elements.formulaDrawer.classList.toggle("expanded");
        });
    }

    // Quick Risk Preset Buttons
    if (elements.riskPresetButtons) {
        elements.riskPresetButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const riskVal = btn.dataset.risk;
                if (elements.riskInput) {
                    elements.riskInput.value = parseFloat(riskVal).toFixed(2);
                }
                elements.riskPresetButtons.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                recalculate();
            });
        });
    }

    if (elements.riskInput) {
        elements.riskInput.addEventListener("input", () => {
            const currentRisk = parseFloat(elements.riskInput.value);
            if (elements.riskPresetButtons) {
                elements.riskPresetButtons.forEach(btn => {
                    const btnRisk = parseFloat(btn.dataset.risk);
                    if (!isNaN(currentRisk) && Math.abs(currentRisk - btnRisk) < 0.01) {
                        btn.classList.add("active");
                    } else {
                        btn.classList.remove("active");
                    }
                });
            }
        });
    }

    // Copyable Result Rows & Action Buttons
    if (elements.copyableRows) {
        elements.copyableRows.forEach(row => {
            row.addEventListener("click", () => {
                const targetId = row.dataset.copyTarget;
                const targetEl = targetId ? document.getElementById(targetId) : null;
                const badgeEl = row.querySelector(".copy-badge");
                if (targetEl) {
                    const text = targetEl.textContent.trim();
                    copyTextToClipboard(text, badgeEl);
                }
            });
        });
    }

    // Mobile Floating Result Bar Actions
    if (elements.btnMobileCopy) {
        elements.btnMobileCopy.addEventListener("click", (e) => {
            e.stopPropagation();
            if (elements.mobileStickyLot) {
                const lotVal = elements.mobileStickyLot.textContent.trim();
                copyTextToClipboard(lotVal);
                if (elements.mobileCopyText) {
                    const originalText = elements.mobileCopyText.textContent;
                    elements.mobileCopyText.textContent = "Copied!";
                    setTimeout(() => {
                        elements.mobileCopyText.textContent = originalText;
                    }, 1400);
                }
            }
        });
    }

    function scrollToResults() {
        if (elements.resultPanel) {
            elements.resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }

    if (elements.mobileStickyInfo) {
        elements.mobileStickyInfo.addEventListener("click", scrollToResults);
    }
    if (elements.btnMobileViewResults) {
        elements.btnMobileViewResults.addEventListener("click", scrollToResults);
    }

    // IntersectionObserver to hide mobile sticky bar when result panel is visible
    if ("IntersectionObserver" in window && elements.resultPanel && elements.mobileStickyBar) {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    elements.mobileStickyBar.classList.add("bar-hidden");
                } else {
                    elements.mobileStickyBar.classList.remove("bar-hidden");
                }
            });
        }, { threshold: 0.15 });
        obs.observe(elements.resultPanel);
    }

    // Desktop Keyboard Shortcuts & Input Dismissal
    window.addEventListener("keydown", (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toUpperCase() : "";
        const isInputActive = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";

        if (isInputActive) {
            if (e.key === "Enter" || e.key === "Escape") {
                document.activeElement.blur();
            }
            return;
        }

        if (e.key === "Escape") {
            window.location.href = "../main-page/index.html";
            return;
        }

        if (e.key === "1") {
            setInstrument("XAUUSD");
        } else if (e.key === "2") {
            setInstrument("BTCUSDT.P");
        } else if (e.key === "r" || e.key === "R") {
            setCalcMode("risk");
        } else if (e.key === "c" || e.key === "C") {
            setCalcMode("lot");
        } else if (e.key === "t" || e.key === "T") {
            const isDark = document.documentElement.getAttribute("data-theme") === "dark";
            applyTheme(isDark ? "light" : "dark");
        }
    });

    // Window resize slider positioning
    window.addEventListener("resize", syncAllSegmentedSliders);

    // Input Listeners
    const allInputs = [
        elements.balanceInput,
        elements.riskInput,
        elements.accountBalanceLot,
        elements.customLotInput,
        elements.slPipsInput,
        elements.xauSlDiffInput,
        elements.xauEntryPriceInput,
        elements.xauSlPriceInput,
        elements.cryptoEntryPriceInput,
        elements.cryptoSlPriceInput,
        elements.cryptoSlDiffInput,
        elements.cryptoSlPctInput,
        elements.cryptoTpPriceInput
    ];

    allInputs.forEach(input => {
        if (input) {
            input.addEventListener("input", recalculate);
            input.addEventListener("change", recalculate);
        }
    });

    // Initial load
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

    setInstrument("XAUUSD");
    syncAllSegmentedSliders();

    // ==========================================================================
    // 4. MOBILE ACCIDENTAL ZOOM PREVENTION
    // ==========================================================================

    // Prevent iOS Safari gesture pinch-zoom
    document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
    document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
    document.addEventListener("gestureend", (e) => e.preventDefault(), { passive: false });

    // Prevent multi-touch pinch zooming while allowing normal single-finger swiping
    document.addEventListener("touchstart", (e) => {
        if (e.touches && e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener("touchmove", (e) => {
        if (e.touches && e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });

    // Prevent double-tap zoom on iOS Safari while allowing tap interactions on buttons/inputs
    let lastTouchEndTime = 0;
    document.addEventListener("touchend", (e) => {
        const now = Date.now();
        if (now - lastTouchEndTime <= 300) {
            if (!["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(e.target.tagName)) {
                e.preventDefault();
            }
        }
        lastTouchEndTime = now;
    }, false);

    // Prevent Ctrl + Wheel zoom on desktop trackpads / mice
    window.addEventListener("wheel", (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
        }
    }, { passive: false });

    // ==========================================================================
    // 5. UNSELECTABLE TEXT ENFORCEMENT
    // ==========================================================================

    // Prevent text drag-selection across all displayed text (except editable inputs)
    document.addEventListener("selectstart", (e) => {
        if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
            e.preventDefault();
        }
    });

    // Prevent manual copy across all displayed text
    document.addEventListener("copy", (e) => {
        const activeEl = document.activeElement;
        if (!activeEl || (activeEl.tagName !== "INPUT" && activeEl.tagName !== "TEXTAREA")) {
            e.preventDefault();
        }
    });

    // Prevent dragging static text
    document.addEventListener("dragstart", (e) => {
        if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
            e.preventDefault();
        }
    });
});
