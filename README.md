# Veyra Trading · Position Size Calculator

> **Precision quantitative reverse-deduction lot sizing and liquidation-safe leverage engine for Gold (XAUUSD) and Bitcoin (BTCUSDT).**  
> Built with zero runtime dependencies using high-performance Vanilla Web Technologies.

---

## 📖 Table of Contents

1. [Project Overview](#-project-overview)
2. [Core Mathematical Engines](#-core-mathematical-engines)
3. [Supported Instruments & Specifications](#-supported-instruments--specifications)
4. [User Experience & Platform Features](#-user-experience--platform-features)
5. [Architecture & Technology Stack](#-architecture--technology-stack)
6. [AI Agent Development Contract](#-ai-agent-development-contract)
   - [1. Project Rules](#1-project-rules)
   - [2. Development Philosophy](#2-development-philosophy)
   - [3. Information Classification](#3-information-classification)
   - [4. Secrets Management](#4-secrets-management)
   - [5. Git Security Rules](#5-git-security-rules)
   - [6. User Data Protection](#6-user-data-protection)
   - [7. Code Quality & Component Rules](#7-code-quality--component-rules)
   - [8. Frontend & Mobile UX Rules](#8-frontend--mobile-ux-rules)
   - [9. Testing & Verification](#9-testing--verification)
   - [10. Change Scope & Forbidden Actions](#10-change-scope--forbidden-actions)
   - [11. AI Response Standard](#11-ai-response-standard)
   - [12. Golden Rule & Precedence](#12-golden-rule--precedence)

---

## ⚡ Project Overview

**Veyra Trading** is a proprietary quantitative trading utility platform. The **Position Size Calculator** serves as its foundational tool, engineered for professional multi-asset risk management. 

Instead of simplistic static percentage tools, Veyra calculates reverse-deduced execution volume across multiple broker account types (MT5 Standard, MT5 Cent/USC, and Bybit Crypto) with exact step rounding, margin requirements, and a liquidation-safe leverage algorithm that guarantees liquidation price never precedes stop-loss execution.

---

## 📐 Core Mathematical Engines

### 1. Reverse-Deduction Lot Sizing
$$\text{Risk Amount} = \text{Account Equity} \times \left(\frac{\text{Risk \%}}{100}\right)$$

$$\text{Exact Lot} = \frac{\text{Risk Amount}}{\text{Price Distance} \times \text{Contract Size}}$$

$$\text{Executable Lot} = \left\lfloor \frac{\text{Exact Lot}}{\text{Min Lot Step}} \right\rfloor \times \text{Min Lot Step}$$

*Ensures conservative rounding down (`floor`) to strictly prevent actual monetary loss from exceeding the predefined risk allowance.*

### 2. Conservative Liquidation-Safe Leverage Engine
$$\text{SL \%} = \frac{|\text{Entry Price} - \text{SL Price}|}{\text{Entry Price}}$$

$$\text{Max Safe Leverage} = \left\lfloor \frac{1}{\text{SL \%} + \text{MMR} + \text{Fee Buffer}} \right\rfloor$$

* Where:
  - $\text{MMR} \approx 0.004$ (Maintenance Margin Rate for Tier 1 isolated positions)
  - $\text{Fee Buffer} \approx 0.002$ (Slippage and taker close fee contingency)
* **Safety Principle**: Actively downscales recommended leverage so that the broker liquidation price is mathematically guaranteed to stay beyond the stop-loss price.

### 3. Estimated Liquidation Price (Aligned with Bybit Isolated Margin)
$$\text{Long Liq Price} = \text{Entry Price} \times \left(1 - \frac{1}{\text{Leverage}} + \text{Total Reserve}\right)$$

$$\text{Short Liq Price} = \text{Entry Price} \times \left(1 + \frac{1}{\text{Leverage}} - \text{Total Reserve}\right)$$

*Calibrated to Bybit isolated margin mechanics with $\text{Total Reserve} \approx 0.0033$.*

---

## 📊 Supported Instruments & Specifications

| Instrument | Asset Class | Contract Size | Default Tick/Pip Size | Account Models Supported |
| :--- | :--- | :--- | :--- | :--- |
| **XAUUSD** | Spot Gold | $100\text{ oz}$ (USD) / $1\text{ oz}$ (USC) | $\$0.10$ / pip | MT5 Standard USD ($0.01$ step)<br>MT5 USC Cent ($0.01$ step)<br>Bybit / Crypto ($0.001$ step) |
| **BTCUSDT** | Crypto Perpetual | $1\text{ BTC}$ / lot | $\$1.00$ / pip | MT5 Standard ($0.01$ step)<br>USC Cent ($0.01$ step = $0.01$ BTC)<br>Bybit ($0.001$ step) |

---

## 🎨 User Experience & Platform Features

* **Dual Operating Modes**:
  - **Risk Sizing**: Input Equity + Risk % + Stop Loss $\to$ Automated Lot Sizes, Margin, and Liquidation Protection. Features quick risk preset chips (`1%`, `2%`, `3%`, `5%`, `10%`).
  - **Custom Lot**: Input Equity + Specific Lot + Stop Loss + Take Profit $\to$ Calculates exact dollar PnL, % Equity Growth, Risk:Reward ratio, and leverage metrics. Equipped with intelligent steppers starting from `0.001` (BTCUSDT) and `0.01` (XAUUSD).
* **1-Tap Clipboard Copying**: Every computed lot tier and PnL metric features instant 1-tap clipboard copying with animated visual confirmation badges.
* **Mobile Floating Sticky Bar**: Pinned, elevated quick-summary pill on mobile devices with safe-area clearance (`bottom: calc(24px + safe-area)`) that never gets clipped by rounded phone bezels. Automatically hides when the main result card is in viewport via `IntersectionObserver`.
* **Zero Mobile Zoom Jitter**: Hardened against accidental pinch, double-tap, and multi-touch gesture scaling via strict viewport constraints and CSS touch-action rules.
* **Non-Selectable Displayed Text**: All static labels and typography enforce `user-select: none`, providing a native application feel while keeping form input fields fully interactive and editable.
* **Desktop Single-Key Shortcuts**:
  - `1`: Switch to **XAUUSD**
  - `2`: Switch to **BTCUSDT**
  - `R`: Switch to **Risk Sizing**
  - `C`: Switch to **Custom Lot**
  - `T`: Toggle **Dark / Light Theme**
  - `Enter` / `Esc`: Confirm and dismiss virtual/desktop focus

---

## 💻 Architecture & Technology Stack

* **Modular Platform Structure**:
  - `index.html`: Root entry point with instant routing to the Apps Portal.
  - `main-page/`: Dedicated Apps Portal folder (`index.html`, `style.css`, `script.js`) presenting a clean workspace with an intuitive app grid.
  - `calculator/`: Dedicated Position Size Calculator folder (`index.html`, `style.css`, `script.js`) with isolated calculation engines and navigation back to Apps.
* **Styling**: Pure Modular CSS3 with curated design tokens, synchronized dark/light modes, and responsive CSS Grid / Flexbox layouts.
* **Logic**: Vanilla ES6+ JavaScript with isolated pure functional calculation engines and state persistence.
* **Dependencies**: Zero external npm packages, frameworks, or runtime CDNs.

---

## 🛡️ AI Agent Development Contract

> **MANDATORY NOTICE FOR AI AGENTS & VIBE CODING WORKFLOWS:**  
> This specification represents the supreme operating contract for any AI assistant, LLM, or automated developer modifying, extending, or maintaining this repository.

### 1. Project Rules
1. AI must thoroughly inspect the existing codebase before modifying or creating code.
2. AI must prioritize reusing existing functions, styles, and design tokens over writing redundant code.
3. **No Unsanctioned Rewrites**: AI must never rewrite existing functionality without explicit user direction.
4. **No Stack Changes**: AI must never introduce frameworks (React, Vue, Tailwind, Bootstrap, Node backends) unless explicitly commanded by the user.
5. **Preserve Existing Features**: Existing features, calculations, and shortcuts must remain functional.
6. **Maintain Design Cohesion**: Any new UI element must adhere to the design system in `style.css`.
7. **Zero Mobile Regressions**: Viewport scaling restrictions, touch targets ($\ge 44\text{px}$), and unselectable text rules must be maintained.

### 2. Development Philosophy
AI follows a rigorous 5-step engineering lifecycle:
$$\text{Understand} \longrightarrow \text{Plan} \longrightarrow \text{Implement} \longrightarrow \text{Verify} \longrightarrow \text{Report}$$

1. **Understand**: Read code files, locate calculations, map event listeners.
2. **Plan**: Identify the exact minimal diff needed.
3. **Implement**: Smallest safe change; no dead code or unneeded abstractions.
4. **Verify**: Run syntactic checks, verify formulas, confirm edge cases ($0$, blank, negative inputs).
5. **Report**: Concisely document modified files and verification results.

### 3. Information Classification

| Level | Where It Can Appear | Permitted Contents |
| :--- | :--- | :--- |
| **PUBLIC** | README, HTML/CSS/JS, Git Commits | Brand name, math formulas, styling tokens, UI labels, public documentation. |
| **INTERNAL** | Local private notes | Architecture thoughts, internal variable naming, scratch tests. |
| **CONFIDENTIAL** | Environment Variables / Secret Manager | API keys, credentials, session tokens, user identities, database passwords. |
| **NEVER COMMIT** | `.gitignore` excluded | `.env`, `.env.*`, `*.pem`, `*.key`, `credentials.json`, `token.json`. |

### 4. Secrets Management
* Any future server-side secrets must reside in environment variables (`process.env.SECRET`).
* **Frontend Code is Public**: Any variable shipped to the browser (`script.js`, `index.html`) is public. Never place private keys or exchange secret keys in client-side code.

### 5. Git Security Rules
The AI is strictly prohibited from committing:
* Environment files (`.env`, `.env.local`)
* API keys, secret credentials, private tokens
* Real personal user identities, account numbers, or real wallet seeds
* Production database dumps or internal connection strings

### 6. User Data Protection
* Never hardcode real personal or financial account data in code, tests, or documentation.
* Use synthetic test mocks (`500 USD`, `5.00%`, `3400.00 Entry`, `3385.00 SL`).

### 7. Code Quality & Component Rules
* **Smallest Safe Change**: Modify only lines directly tied to the user request.
* **No Bloatware**: Avoid heavy helper libraries for math or date formatting; standard native JavaScript APIs (`Math`, `Intl.NumberFormat`) must be used.
* **Input Resilience**: Form inputs must gracefully handle empty strings, non-numeric characters, `NaN`, and zero division.

### 8. Frontend & Mobile UX Rules
* **Display Text Unselectable**: Keep `user-select: none;` active globally on display elements (`*, *::before, *::after`), while explicitly preserving `user-select: text !important;` on `input, textarea`.
* **Prevent Accidental Mobile Zoom**: Maintain `user-scalable=no, maximum-scale=1.0` and keep touch gesture preventers (`gesturestart`, `touches.length > 1`) active.
* **Safe Floating Margins**: Ensure bottom floating bars maintain `bottom: calc(24px + env(safe-area-inset-bottom))` clearance to avoid curved screen corner clipping.

### 9. Testing & Verification
Before declaring a task complete, verify:
* [x] **Normal Case**: Standard inputs generate mathematically accurate outputs.
* [x] **Blank / Reset Case**: Blank inputs display placeholders (`—`) without throwing console errors.
* [x] **Stepper Invariants**: Custom lot `+` starts from `0.001` (BTCUSDT) and `0.01` (XAUUSD) when blank.
* [x] **Safety Leverage Invariant**: Liquidation price is always lower than Long SL (or higher than Short SL).
* [x] **Responsive Layout**: Verified down to $320\text{px}$ viewport width.

### 10. Change Scope & Forbidden Actions
Unless explicitly commanded by the user, the AI will NEVER:
* Delete git history or force push (`git push -f`).
* Rename repository files without reason.
* Remove existing calculation options or formula explanations.
* Weaken mobile touch constraints or security settings.
* Guess API endpoints or business rules.

### 11. AI Response Standard
Upon completing any development task, the AI reports:
* **Summary**: High-level explanation of user requirements fulfilled.
* **Files Changed**: Clickable list of modified or created files.
* **Implementation Details**: Clear rationale for mathematical or visual updates.
* **Verification**: Testing and validation results across devices.
* **Git Status**: Commit hash and remote push confirmation.

### 12. Golden Rule & Precedence
$$\text{User's Explicit Instruction} > \text{Security Standards} > \text{Existing Architecture} > \text{This Specification} > \text{AI Preference}$$

> *"Understand the system before changing it. Make the smallest safe change. Verify before reporting."*

---

## 📄 License & Disclaimer

* **Disclaimer**: Veyra Trading is a quantitative calculation instrument. All outputs are mathematical estimations based on user-supplied inputs and standard broker contract parameters. This software does not constitute financial, investment, or trading advice.
* **Copyright**: © 2026 Veyra Trading. All rights reserved.
