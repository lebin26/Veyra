# Veyra Trading · Quantitative Trading Platform & Risk Engine

> **Precision quantitative reverse-deduction lot sizing, liquidation-safe leverage engine, and unified application portal for Gold (XAUUSD) and Bitcoin (BTCUSDT).**  
> Built with zero frontend runtime dependencies using Vanilla Web Technologies, powered by Cloudflare Pages and Cloudflare D1 SQLite.

---

## 📖 Table of Contents

1. [Platform Overview](#-platform-overview)
2. [Core Mathematical Engines](#-core-mathematical-engines)
3. [Supported Instruments & Specifications](#-supported-instruments--specifications)
4. [Application Modules & User Experience](#-application-modules--user-experience)
   - [Position Size Calculator](#1-position-size-calculator)
   - [Applications Portal](#2-applications-portal)
   - [Administrative Control Panel (RBAC)](#3-administrative-control-panel-rbac)
   - [Access Control & Soft Lock Overlays](#4-access-control--soft-lock-overlays)
   - [Legal Compliance & Privacy](#5-legal-compliance--privacy)
5. [Architecture & Cloudflare Stack](#-architecture--cloudflare-stack)
6. [Security & Zero Information Leakage](#-security--zero-information-leakage)
7. [AI Agent Development Rules](#-ai-agent-development-rules)
8. [Setup & Deployment Guide](#-setup--deployment-guide)
9. [License & Disclaimer](#-license--disclaimer)

---

## ⚡ Platform Overview

**Veyra Trading** is a proprietary quantitative trading utility platform designed for disciplined risk management. 

Instead of simplistic static percentage tools, Veyra calculates reverse-deduced execution volume across multiple broker account types (MT5 Standard, MT5 Cent/USC, and Bybit Crypto) with exact step rounding, margin requirements, and a liquidation-safe leverage algorithm that guarantees liquidation price never precedes stop-loss execution.

The platform includes an **Application Portal**, **Admin RBAC Management**, **Cloudflare D1-backed Authentication**, and **Soft Lock Overlays** for unauthenticated access.

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

## 🎨 Application Modules & User Experience

### 1. Position Size Calculator
* **Dual Operating Modes**:
  - **Risk Sizing**: Input Equity + Risk % + Stop Loss $\to$ Automated Lot Sizes, Margin, and Liquidation Protection. Quick risk preset chips (`1%`, `2%`, `3%`, `5%`, `10%`).
  - **Custom Lot**: Input Equity + Specific Lot + Stop Loss + Take Profit $\to$ Calculates exact dollar PnL, % Equity Growth, Risk:Reward ratio, and leverage metrics. Steppers start from `0.001` (BTCUSDT) and `0.01` (XAUUSD).
* **1-Tap Clipboard Copying**: Every computed lot tier and PnL metric features instant 1-tap clipboard copying with animated visual confirmation badges.
* **Mobile Floating Sticky Bar**: Pinned, elevated quick-summary pill on mobile devices with safe-area clearance (`bottom: calc(24px + env(safe-area-inset-bottom))`). Hides automatically when the main result card is in viewport via `IntersectionObserver`.
* **Zero Mobile Zoom Jitter**: Hardened against accidental pinch, double-tap, and multi-touch gesture scaling via strict viewport constraints and CSS touch-action rules.
* **Non-Selectable Displayed Text**: All static labels and typography enforce `user-select: none`, while form input fields remain fully interactive and editable.
* **Desktop Single-Key Shortcuts**:
  - `1`: Switch to **XAUUSD**
  - `2`: Switch to **BTCUSDT**
  - `R`: Switch to **Risk Sizing**
  - `C`: Switch to **Custom Lot**
  - `T`: Toggle **Dark / Light Theme**
  - `Enter` / `Esc`: Confirm and dismiss virtual/desktop focus

### 2. Applications Portal (`main-page/`)
* Central workspace hub featuring unified application cards, permission badges, user greeting, and direct links to tools.
* Dynamically indicates which tools are accessible, locked, or restricted.

### 3. Administrative Control Panel (RBAC) (`admin/`)
* Accessible only to accounts with `role === 'admin'`.
* **User Management**: Search, view user status (Active / Inactive), reset user passwords, and toggle account states.
* **Per-App Access Control**: Granular matrix granting or revoking individual application access (`calculator`, `journal`, `radar`, etc.) per user.
* **Bulk Permissions**: Grant or revoke access to all applications across user accounts.

### 4. Access Control & Soft Lock Overlays
* **No Abrupt Redirects**: When an unauthenticated or unauthorized user accesses a protected app, the page remains stable and displays a frosted semi-transparent backdrop overlay with a lock icon, status explanation, and a clean login call-to-action.

### 5. Legal Compliance & Privacy (`legal/`)
* **Terms of Service (`legal/terms.html`)**: Clear terms of use, intellectual property clauses, no-financial-advice disclaimers, and limitation of liability.
* **Privacy Policy (`legal/privacy.html`)**: Data minimization commitments, session cookie usage details, and zero third-party telemetry or ad tracking.

---

## 💻 Architecture & Cloudflare Stack

* **Frontend**: Pure Vanilla Web (HTML5, Modular CSS3, Modern ES6+ JavaScript). Zero npm packages, zero runtime frameworks, zero frontend build overhead.
* **Cloudflare Pages & Functions**: Serverless edge endpoints in `functions/api/`:
  - `functions/api/auth/` — Login, Logout, Session Verification (`me`), Password Change.
  - `functions/api/admin/` — User management, RBAC inspection, per-app access updates.
  - `functions/api/trades/` — Trade journal records and quantitative logs.
* **Database**: Cloudflare D1 (Serverless SQLite at the edge):
  - `users` — Unique usernames, PBKDF2 password hashes, salts, and roles (`admin`, `user`).
  - `sessions` — Cryptographically random tokens with 30-day expiration and automatic renewal.
  - `apps` & `user_app_access` — Granular application permission control matrix.
  - `trades` & `audit_logs` — Trading journal entries and administrative security audits.
* **Cryptography**: Web Crypto API (`crypto.subtle`) using PBKDF2-SHA256 with 100,000 iterations and 16-byte random salts.
* **Local Offline Environment**: Offline fallback support via `start_veyra.bat` and `Journal/server.ps1`.

---

## 🔒 Security & Zero Information Leakage

The platform is hardened for public production deployment:
1. **Zero Secret Exposure**: Passwords, hashes, and internal connection strings are removed from git-tracked schemas and client assets. Initial administrator credentials are dynamically bootstrapped via environment variables.
2. **Sanitized User Errors**: All API endpoints and client views display generic, secure error messages without revealing internal stack traces, SQL syntax, or filesystem paths.
3. **Crawler Protection**: `robots.txt` blocks web search crawlers (`User-agent: *`, `Disallow: /`), protecting private trading utilities from indexing.
4. **Git Hygiene**: Environment files (`.env*`) and Cloudflare build artifacts (`.wrangler/`, `dist/`) are strictly ignored in `.gitignore`.

---

## 🛡️ AI Agent Development Rules

All AI assistants, LLMs, and automated contributors must adhere to the **AI Agent Operating Contract**. Detailed guidelines are maintained in [AGENTS.md](file:///c:/Users/lebin/OneDrive/Documents/Dev/GitHub/Veyra/AGENTS.md).

### Core Pillars
1. **Supreme Visual Contract (`calculator/` Standard)**: All new modules, views, and components must strictly mirror the styling tokens, card borders, typography, header hierarchy, and 140ms hover transitions of `calculator/`.
2. **Access Control Rule**: Never perform jarring, unprompted redirects when access is denied; always display a frosted glass lock overlay.
3. **Smallest Safe Change**: Modify only lines directly requested. Never perform unprompted architectural rewrites or add heavy frameworks (React, Vue, Tailwind).
4. **Input & Invariant Resilience**: Always verify formulas, rounding invariants, and edge cases ($0$, blank, negative inputs).

$$\text{User's Explicit Instruction} > \text{Security Standards} > \text{Existing Architecture} > \text{Contract} > \text{AI Preference}$$

---

## 🚀 Setup & Deployment Guide

### 1. Cloudflare Pages Deployment
1. Connect the GitHub repository to **Cloudflare Pages**.
2. **Build Settings**:
   - Framework preset: `None`
   - Build output directory: `/` (Root)
3. **Cloudflare D1 Binding**:
   - In Cloudflare Pages Settings $\to$ Functions $\to$ D1 Database Bindings:
   - Variable name: `DB`
   - Bound database: Your created D1 database (e.g. `veyra-db`).
4. **Execute Database Schema**:
   ```bash
   npx wrangler d1 execute veyra-db --file=./d1/schema.sql --remote
   ```
5. **Initial Administrator Bootstrap**:
   - Set environment variables in Cloudflare Pages dashboard:
     - `ADMIN_INITIAL_USERNAME`: (Your desired admin username)
     - `ADMIN_INITIAL_PASSWORD`: (Your strong admin password)
   - On the first login with these credentials, the system automatically creates the admin account in D1 with a PBKDF2 hash.

### 2. Local Development
Double-click `start_veyra.bat` or run:
```powershell
powershell -ExecutionPolicy Bypass -File Journal/server.ps1
```
Navigate to `http://localhost:8080/main-page/` in your browser.

---

## 📄 License & Disclaimer

* **Disclaimer**: Veyra Trading is a quantitative calculation and risk management instrument. All outputs are mathematical estimations based on user-supplied inputs and standard broker contract parameters. This software does not constitute financial, investment, or trading advice.
* **Copyright**: © 2026 Veyra Trading. All rights reserved.
