# Veyra Trading · UI Specification & Unified Design Language Standard

> **SUPREME UI & VISUAL SPECIFICATION ACROSS ALL VEYRA SURFACES**  
> Benchmark: Linear & Vercel Dashboard aesthetic — Minimalist, Flat, Smooth, Quantitative Elegance.  
> Target: "Enter a few numbers → instantly see results." Data and core outputs are the heroes of the page.

---

## 1. Hard Constraints & Operating Rules

1. **Pure Presentation Layer**:
   - Only modify visual styles, layout, spacing, and presentation-layer interactions.
   - **Never** modify core calculation formulas, backend endpoints, state machines, data flow, or application state.
   - **Never** remove fields, features, or options.
   - Keep all user interface labels, descriptions, and copy in clean English.
2. **Zero External UI Libraries**:
   - No Tailwind, React, Vue, Bootstrap, or icon packs.
   - Rely solely on native Vanilla Web Technologies (HTML5, Vanilla CSS custom properties, native Web APIs).
3. **Strict Token Architecture**:
   - All colors, margins, paddings, border radii, and font sizes must reference CSS variables defined in `:root` and `[data-theme="dark"]`.
   - **Strictly prohibit** hardcoded hex colors, ad-hoc inline pixel sizes, or arbitrary style overrides.
4. **Logic Audit Policy**:
   - Any suspected logic bugs, edge cases, or ambiguity must be documented and reported in audit sections, never changed arbitrarily without explicit user confirmation.

---

## 2. Core Design Principles

1. **One True Focal Point**:
   - In calculation and trading tools, the calculated Lot Size (or primary quantitative outcome) is the hero element (28px / 600 weight).
2. **Hierarchy via Typography & Whitespace (Not Heavy Borders & Backgrounds)**:
   - Convey section groupings, hierarchy, and relationships using font scale, weight, and breathing room.
   - **Single Styling Rule**: An element may use *either* a subtle border *or* a subtle fill, never both stacked heavily together.
3. **Single Accent Color**:
   - The brand accent is strictly **Veyra Blue** (`#2F5BFF` in light, `#4F75FF` in dark).
   - The accent is reserved exclusively for: interactive focus rings, active chips/toggles, and text links.
   - Semantic Green (`#1A7F4B`) and Red (`#C43D3D`) are strictly reserved for profit/loss, long/short, or dangerous operations.
4. **Strict Prohibitions**:
   - 🚫 **No Gradients**
   - 🚫 **No Glassmorphism / Frosted Blur Cards**
   - 🚫 **No Colorful Badges or Skeuomorphic Highlights**
   - 🚫 **No Emoji Icons** in production UI labels, buttons, or select options (use clean SVG or pure typography)
   - 🚫 **No Heavy Drop Shadows**

---

## 3. Design Tokens

### Color Palette

| Token | Light Theme | Dark Theme (Calibrated, not inverted) | Usage |
| :--- | :--- | :--- | :--- |
| `--bg-page` | `#FAFAFA` | `#0B0B0C` | Page background |
| `--bg-panel` | `#FFFFFF` | `#141416` | Panel / Card background |
| `--border-default` | `#E8E8EA` | `#26262A` | Minimal borders & dividers |
| `--fill-subtle` | `#F4F4F5` | `#1C1C1F` | Input fills, inactive segmented tracks |
| `--fill-slider` | `#FFFFFF` | `#2A2A2E` | Active segmented slider thumb |
| `--text-primary` | `#111113` | `#EDEDEF` | Primary headers, data values, active text |
| `--text-secondary` | `#6B6B73` | `#9A9AA2` | Labels, subheadings, explanations |
| `--text-placeholder`| `#8A8A93` | `#4E4E58` | Input placeholder text (clean, distinct) |
| `--text-empty` | `#B4B4BB` | `#52525B` | Null/empty value placeholders (`—`) |
| `--color-brand` | `#2F5BFF` | `#4F75FF` | Single brand accent |
| `--color-profit` | `#1A7F4B` | `#22C55E` | Profit, Long positions |
| `--color-loss` | `#C43D3D` | `#EF4444` | Loss, Short positions, errors |
| `--color-warn` | `#D97706` | `#F59E0B` | Warnings, liquidation buffers |

### Typography
- **Font Stack**: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`. Monospace fonts are prohibited in standard forms and tables.
- **Tabular Numerics**: `font-variant-numeric: tabular-nums;` enforced on all numbers, inputs, tables, readouts, and steppers to prevent jitter.
- **Type Scale**: `12px` (sublabels, units), `14px` (body, section headers), `16px` (inputs, values), `20px` (metrics, modal titles), `28px` (hero lot size, page titles).
- **Font Weights**: `400` (body), `500` (labels, readouts), `600` (hero values, primary buttons, section titles).
- **Line Heights**: Body text `1.5`; Large numerical heroes `1.1`.

### Spacing & Geometry (4px Base Grid)
- **Spacing Units**:
  - Section-to-section: `40px`
  - Field-to-field: `16px`
  - Label-to-input: `6px`
- **Corner Radii**:
  - Controls & Inputs: `8px` (`--radius-control`)
  - Panels & Cards: `12px` (`--radius-panel`)
  - Chips & Pills: `999px` (`--radius-chip`)
  - **Nested Geometry Rule**: When elements nest, $\text{inner radius} = \text{outer radius} - \text{spacing}$.

### Restricted Shadows
Shadows are restricted to only two functional places across the entire platform:
1. **Segmented Slider Thumb**: `0 1px 2px rgba(0, 0, 0, 0.06)`
2. **Dropdown / Popover / Modal Overlay**: `0 8px 24px rgba(0, 0, 0, 0.06)` (Dark mode: `rgba(0, 0, 0, 0.25)`)

### Transitions & Motion
- Hover & Press transitions: `140ms ease`
- Tab & Mode Switches: `220ms cubic-bezier(0.22, 1, 0.36, 1)`
- Theme Transition: Transition only `background-color` and `color` over `200ms ease`.
- Only animate `transform` and `opacity` (use CSS grid `grid-template-rows: 0fr` $\to$ `1fr` for height transitions).
- Respect `@media (prefers-reduced-motion: reduce)`.

---

## 4. Layout Standards

1. **Tool & Form Layouts (Calculator, Auth)**:
   - Render directly on `--bg-page` without an artificial outer desktop device card.
   - Max width: `1040px` centered via `margin: 0 auto;`.
   - **Desktop ($\ge 960\text{px}$)**: Two-column layout.
     - Left column: Input fields (`max-width: 520px`).
     - Right column: Sticky result panel (`position: sticky; top: 24px`).
   - **Mobile ($< 960\text{px}$)**: Single column with the result panel positioned immediately below the input fields.
2. **Dashboard & Data Table Layouts (Admin Console, Data Grids)**:
   - Full-width fluid responsive container (`width: 100%; max-width: 100%;`).
   - Dynamic gutter padding: `padding: 24px clamp(16px, 2.5vw, 40px);`.
   - Eliminates dead side margins on widescreen displays while preserving comfortable reading gutters.
   - Tables enforce `min-width: 960px` with `overflow-x: auto;` inside a clean card wrapper.
3. **Header Hierarchy**:
   - Header container: `.app-header` with brand mark + 13px bold uppercase tracking brand name.
   - Static titles using Sentence case (e.g. `Lot calculator`, `Trading Applications`, `Admin Console`).
   - Theme toggle: Minimalist 36px rounded ghost button with SVG sun/moon glyph and `aria-label="Toggle theme"`.

---

## 5. Component Specifications

### 1. Segmented Control
- Uniform component for switching Asset, Calculation Mode, Stop Loss Mode, or Trade Direction (Long/Short).
- Track: `--fill-subtle` background, `2px` internal padding, `8px` corner radius.
- Sliding Thumb: `--fill-slider`, `0 1px 2px rgba(0,0,0,0.06)` shadow, moves via `translateX(index * 100%)` over `220ms`.
- Items: Equal width (`grid-auto-columns: 1fr`).
- Selected Item: `--text-primary` with `500` font-weight. Unselected: `--text-secondary`.
- Long/Short switchers only use a `6px` green or red circular indicator dot before the text.

### 2. Form Inputs
- Height: `44px` (touch-friendly and prevents iOS auto-zoom via `16px` font size).
- Background: `--bg-panel` + `1px solid var(--border-default)`. No inner shadows.
- Unit affix: Single affix (either prefix or suffix, never both simultaneously; e.g. `USD` suffix on Account Equity).
- Labels: `12px` font size, `500` weight, `--text-secondary`, no trailing colons.
- Focus State: Border transitions to `--color-brand` with a `3px` subtle brand ring (`rgba(47, 91, 255, 0.16)`).
- Error State: Border changes to `--color-loss` with a reserved `16px` error hint below the field.

### 3. Stepper & Quick Chips
- Minus/Plus Steppers: `32px` borderless ghost buttons with hover fill, centered numeric display. Step indicator aligned to the right of the label (`12px` secondary text).
- Quick Chips: Height `32px` (mobile `36px`), `--fill-subtle` fill with no border. Selected state = subtle brand tint background + brand colored text.

### 4. Readout Rows
- Replaces bulky gray boxes with clean text rows below corresponding inputs.
- Left: Label in `--text-secondary`.
- Right: Value in `--text-primary` (`500` weight, `32px` line-height). Example: `150 pips = $15.00`.

### 5. Result Panel (Hero Element)
- Single card container with `1px solid var(--border-default)`.
- Internal sections separated by clean `1px` subtle divider lines.
- Left column: Platform name (`14px / 500`), subtitle in format `Currency · Min Step · Contract Size` (`12px` secondary text).
- Right column: Hero Lot Size (`28px / 600` weight) + Unit (`12px` secondary text).
- Empty State: Displays `28px` empty dash (`—`) in `--text-empty` color, accompanied by a clean guidance hint (e.g. *"Enter account equity to see lot sizes"*).

---

## 6. Logic Invariant Audit & Findings

During rigorous inspection of the core calculation engine (`calculator/script.js`), three specific domain questions were evaluated:

1. **Question 1: Can XAUUSD Custom Lot calculate TP Profit / R:R without a TP input?**
   - **Audit Finding**: In XAUUSD mode, the Stop Loss section only accepts SL parameters (Pips, Price Diff, or Entry/SL Price); there is deliberately no Take Profit (TP) input field in the XAUUSD UI. Consequently, `tpPrice` remains `0`, and the Take Profit and R:R readout cards cleanly and correctly display `—` with fallback label hints. For BTCUSDT, entering a Take Profit price calculates TP Profit and R:R; leaving it blank also displays `—`.
2. **Question 2: Is the Account Equity 500.00 a placeholder or a default value? Why does Risk Amount display "–"?**
   - **Audit Finding**: `500` is strictly a placeholder (`placeholder="e.g. 500"`), with `value=""` initially empty. Because no value is populated upon first load, `parseFloat("")` yields `NaN`, causing the initial Risk Amount to display the empty placeholder `—`. This adheres to the rule that placeholders must never be treated as filled data.
3. **Question 3: Are lot sizes across all platforms floored by their respective minimum step sizes?**
   - **Audit Finding**: Yes. All platforms use `Calculator.calculateLotSize(exactLot, lotStep)` which strictly applies `Math.floor((exactLot + 1e-9) / lotStep) * lotStep`. MT5 USD and Cent accounts floor to `0.01` steps, and Bybit Crypto accounts floor to `0.001` steps, fully protecting traders against fractional over-allocation and exchange rejection.

---

## 7. Platform Verification Matrix

| Page / Surface | Status | Design System Compliance |
| :--- | :--- | :--- |
| `calculator/index.html` | Benchmark | 100% compliant: dual-theme tokens, 1040px shell, sticky results, segmented controls, 44px inputs. |
| `main-page/index.html` | Compliant | 100% compliant: 1040px shell, squircle app tiles, minimal header, synced dark/light theme. |
| `admin/index.html` | Compliant | Fluid full-width dashboard layout, tabular-nums, single blue brand accent, no emojis, Merge Sort & Binary Search. |
| `auth/login.html` | Compliant | 100% compliant: 44px inputs, unified `:root` and `[data-theme="dark"]` tokens, accessible focus states. |
| `legal/*.html` | Compliant | 100% compliant: typography scale, theme synchronizer, Inter font stack. |
