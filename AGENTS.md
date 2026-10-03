# Veyra Trading · AI Agent Development Rules & Operating Contract

> **MANDATORY DIRECTIVE FOR ALL AI AGENTS, ASSISTANTS, AND AUTOMATED DEVELOPERS**  
> This specification defines the supreme engineering, architectural, visual, and security guidelines for the Veyra repository. All modifications must comply with these rules.

---

## 1. Project Overview & Architecture

**Veyra Trading** is a proprietary quantitative trading utility platform built with zero runtime frontend dependencies using Vanilla Web Technologies, powered by Cloudflare Pages and Cloudflare D1 SQLite.

### Directory Structure & Responsibilities
- `calculator/` — Flagship Position Size Calculator & Liquidation-Safe Leverage Engine. **This is the supreme visual and UX benchmark for the entire project.**
- `main-page/` — Applications Portal displaying workspace apps, dynamic lock badges, and quick launch cards.
- `admin/` — Administrative Control Panel for user management, role-based access control (RBAC), and per-app permission toggling.
- `auth/` — Secure authentication views (Login, Password Change).
- `legal/` — Terms of Service (`terms.html`) and Privacy Policy (`privacy.html`).
- `functions/api/` — Cloudflare Pages Functions backend (Auth, Admin RBAC, Trades, D1 database interactions).
- `js/auth/` — Frontend client authentication state and session validation (`authState.js`).
- `d1/schema.sql` — Cloudflare D1 SQLite database schema (Users, Sessions, App Permissions, Trades, Audit Logs).
- `robots.txt` — Search engine crawler exclusion to safeguard private application surfaces.
- `start_veyra.bat` / `Journal/server.ps1` — Local offline development harness.

---

## 2. Supreme Visual & UX Contract (DESIGN_SPEC.md Standard)

All existing and future pages, modules, dialogs, and components **MUST strictly comply with [DESIGN_SPEC.md](DESIGN_SPEC.md)**.

1. **Design Tokens**:
   - Must strictly utilize CSS custom properties defined in `calculator/style.css` and `DESIGN_SPEC.md`:
     - Backgrounds: `--bg-page` (`#FAFAFA` / `#0B0B0C`), `--bg-panel` (`#FFFFFF` / `#141416`), `--fill-subtle` (`#F4F4F5` / `#1C1C1F`), `--fill-slider` (`#FFFFFF` / `#2A2A2E`)
     - Borders: `--border-default` (`#E8E8EA` / `#26262A`)
     - Typography: `--text-primary` (`#111113` / `#EDEDEF`), `--text-secondary` (`#6B6B73` / `#9A9AA2`), `--text-placeholder` (`#8A8A93` / `#4E4E58`), `--text-empty` (`#B4B4BB` / `#52525B`)
     - Single Brand Accent: `--color-brand` (`#2F5BFF` / `#4F75FF`) reserved exclusively for focus rings, active chips/toggles, and links.
     - Semantic Colors: Profit/Long `--color-profit` (`#1A7F4B` / `#22C55E`), Loss/Short `--color-loss` (`#C43D3D` / `#EF4444`), Warning `--color-warn` (`#D97706` / `#F59E0B`).
     - Geometry: Base 4px grid. Controls `--radius-control: 8px`, Panels `--radius-panel: 12px`, Chips `--radius-chip: 999px`.
2. **Standard Header Hierarchy**:
   - Header container: `.app-header` inside `.app-shell` (1040px max for tools; full-width fluid `padding: 24px clamp(16px, 2.5vw, 40px)` for data tables/dashboards).
   - Top row: `.brand-eyebrow` (8px brand square + 13px bold uppercase tracking brand name) + `.theme-ghost-btn` (36px borderless ghost toggle with SVG sun/moon glyph and `aria-label`).
   - Title: Sentence case, static, 21px bold -0.02em letter spacing.
3. **Core Principles & Prohibitions**:
   - **One Focal Hero**: Key quantitative outcome (Lot Size) is the 28px/600 hero.
   - **Hierarchy via Typography & Space**: An element uses *either* a subtle border *or* a subtle fill, never both stacked.
   - **Strictly Prohibited**: Gradients, glassmorphism, colorful badges, emoji icons, and heavy drop shadows.
   - **Restricted Shadows**: Only 2 functional places: Segmented slider thumb (`0 1px 2px rgba(0,0,0,0.06)`) and Popover/Modal (`0 8px 24px rgba(0,0,0,0.06)`).
4. **Theme Synchronization**:
   - Dark and light modes must remain 100% color-calibrated and synchronized across all applications via `localStorage.getItem("calc_theme")` and `prefers-color-scheme`.
5. **Typography & Tabular Numerics**:
   - System/Inter font stack (`Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
   - All numbers, readouts, steppers, tables, and inputs enforce `font-variant-numeric: tabular-nums` to eliminate jitter.
   - Static labels enforce `user-select: none`. Editable fields preserve `user-select: text !important`.
   - Motion: 140ms hover transitions, 220ms tab/slider transitions (`cubic-bezier(0.22, 1, 0.36, 1)`).

---

## 3. Access Control & UX Interaction Standard

1. **Soft Lock Overlays (No Abrupt Redirects)**:
   - When an unauthenticated or unauthorized user accesses a protected app or tool:
     - **DO NOT** perform immediate, jarring HTTP redirects or empty white-screen transfers.
     - **Portal App Grid Icons**: Lock overlays (`tile-lock-overlay`) must strictly cover **ONLY the squircle icon/logo**, leaving the application title/name below completely visible and legible.
     - **Direct Page Navigation**: Display a frosted semi-transparent backdrop overlay with a centered lock icon, clear informative copy (e.g., *"Sign in to access this tool"*), and a high-contrast action button leading to `/auth/login.html`.
2. **Role-Based Access Control (RBAC)**:
   - Roles: `admin` and `user`.
   - Admins possess comprehensive authority to view all users, activate/suspend accounts, adjust per-user access to individual apps (`calculator`, `journal`, `radar`, etc.), and trigger password resets.
   - Standard users only have access to modules explicitly permitted in `user_app_access` or designated as public.

---

## 4. Security, Secrets & Zero Information Leakage

1. **Frontend Code is Public**:
   - Everything in HTML, client JavaScript, and CSS is delivered to the browser.
   - **NEVER** place API keys, private keys, database passwords, or secret credentials in client-side code.
2. **Zero Information Leakage in API & UI**:
   - Server errors and API responses must never leak stack traces, SQL syntax errors, database IDs, or internal filesystem paths.
   - User-facing error messages must remain generic and actionable (e.g., *"Invalid username or password"* or *"An internal error occurred. Please try again."*).
   - Login placeholders and forms must never disclose sample usernames, internal account names, or infrastructure details.
3. **Secrets & Cloudflare Environment Variables**:
   - Cloudflare D1 database bindings (`DB`), admin bootstrap credentials (`ADMIN_INITIAL_USERNAME`, `ADMIN_INITIAL_PASSWORD`), and session secrets must live in Cloudflare Pages configuration or `.env` files.
   - `.env`, `.env.*`, and `.wrangler/` must **ALWAYS** remain git-ignored.
4. **No Hardcoded Passwords in Schemas**:
   - `d1/schema.sql` must strictly define schema structures, indexes, and metadata.
   - Password hashes must never be committed to repository SQL files.
5. **Search Engine Indexing Control**:
   - Maintain `robots.txt` blocking crawlers (`User-agent: *`, `Disallow: /`) to prevent indexing of invite-only tools.
   - Keep `<meta name="robots" content="noindex, nofollow">` on auth and admin pages.

---

## 5. Engineering Standards & Code Quality

1. **Zero External Runtime Dependencies**:
   - Avoid introducing external frameworks (React, Vue, Angular, Tailwind, Bootstrap) or heavy utility libraries (Lodash, Moment).
   - Use modern, native Web APIs:
     - Math: Native `Math` operations with rounding invariants.
     - Formatting: Native `Intl.NumberFormat`.
     - Crypto: Web Crypto API (`crypto.subtle` with PBKDF2-SHA256, 100,000 iterations).
2. **Smallest Safe Change Principle**:
   - Modify only code directly related to the user's specific request.
   - Never perform unsolicited rewrites, file renamings, or code deletion.
3. **Form & Calculation Resilience**:
   - Handle empty strings, non-numeric values, negative numbers, and zero division gracefully.
   - When inputs are incomplete, display clean placeholders (`—`) rather than `NaN` or unhandled exceptions.
4. **Mobile UX & Anti-Jitter Invariants**:
   - Viewport meta must prevent accidental double-tap and pinch-zoom jitter:
     `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`.
   - Maintain touch-action restrictions on interactive surfaces where gesture scaling interferes with utility usage.
   - Touch targets must adhere to $\ge 44\text{px}$ minimum size.
   - Pinned mobile summary bars must respect safe area clearances: `bottom: calc(24px + env(safe-area-inset-bottom))`.

---

## 6. Testing & Verification Checklist

Before reporting task completion, verify:
- [ ] **Visual Consistency**: Adheres to `calculator/` theme tokens, fonts, spacing, and header styles.
- [ ] **Dual Theme Support**: Tested in both Dark and Light modes without color inversions or unreadable text.
- [ ] **Mathematical Integrity**: Reverse-deduced lot sizes, risk amounts, and liquidation safeguards calculate correctly.
- [ ] **Authentication State**: Logged in, logged out, and unauthorized states render appropriately with lock overlays where applicable.
- [ ] **Security Sanitization**: No credentials, hashes, debug traces, or infrastructure details exposed.
- [ ] **Mobile Responsiveness**: Verified across viewports down to $320\text{px}$.

---

## 7. Golden Rule & Precedence

$$\text{User's Explicit Instruction} > \text{Security & Privacy Standards} > \text{Existing Architecture} > \text{This Contract} > \text{AI Preference}$$

> *"Understand the system before changing it. Make the smallest safe change. Verify before reporting."*
