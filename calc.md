Build a minimalist **XAUUSD Lot Size Calculator** web app.

The app is a simple trading risk-management tool. Version 1 supports **XAUUSD only**.

The priority is:

1. Correct calculation
2. Extremely simple UX
3. Fast input → instant result
4. Clean professional trading-tool appearance
5. Responsive design for desktop and mobile

---

# 1. Design Style

Use an **ultra-minimal flat design**.

Style keywords:

* Minimal
* Flat
* Clean
* Professional
* Trading terminal inspired
* High information density
* No unnecessary decoration

DO NOT use:

* Glassmorphism
* Glass cards
* Blur
* Gradients
* 3D effects
* Excessive shadows
* Neumorphism
* Decorative illustrations
* Large hero sections
* Excessive rounded cards
* Unnecessary animations

Use:

* Flat surfaces
* Thin borders
* Small border radius
* Strong typography hierarchy
* Plenty of whitespace
* Simple monochrome UI
* One subtle accent color for important actions/results

The application should feel like a serious trading utility rather than a marketing website.

---

# 2. Layout

Desktop:

Use a centered calculator with a maximum width around `600–700px`.

Structure:

```text
XAUUSD
Lot Size Calculator

ACCOUNT
Balance
[ 500.00 ]

Risk
[ 5.00 ] %

----------------------------

STOP LOSS
SL Size
[ 150 ] pips

Price Distance
$15.00

----------------------------

RISK
Risk Amount
$25.00

----------------------------

RESULT

Exact Lot
0.0167

MT5 Lot
0.01

Actual Risk
$15.00

Risk %
3.00%
```

The result section should be visually more prominent than the input section.

Do not create unnecessary navigation or dashboard sections.

---

# 3. Header

Simple header:

```text
XAUUSD
Lot Size Calculator
```

Add a small instrument label:

```text
XAUUSD · Gold
```

No logo is required.

No large header.

---

# 4. Inputs

## Account Balance

Label:

`Account Balance`

Input:

```text
500.00
```

Currency:

`USD`

Default:

```text
500
```

---

## Risk Percentage

Label:

`Risk`

Input:

```text
5.00
```

Suffix:

`%`

Default:

```text
5
```

Automatically calculate:

```text
Risk Amount = Account Balance × Risk % / 100
```

Example:

```text
500 × 5% = $25
```

---

# 5. Stop Loss Input

Primary input:

```text
SL Size
[ 150 ] pips
```

Default:

```text
150
```

For XAUUSD:

```text
1 pip = 0.10 price movement
```

Therefore:

```text
150 pips = $15 price movement
```

Display:

```text
Price Distance
$15.00
```

---

# 6. Optional Entry / Stop Loss Mode

Provide a small toggle:

```text
SL Pips     Entry / SL
```

Default:

`SL Pips`

### SL Pips mode

User enters:

```text
150 pips
```

Calculate:

```text
priceDistance = 150 × 0.10
              = $15
```

### Entry / SL mode

Show:

```text
Entry Price
[ 4000.00 ]

Stop Loss
[ 3985.00 ]
```

Calculate:

```text
priceDistance = abs(4000 - 3985)
              = $15
```

Then:

```text
pips = 15 / 0.10
     = 150 pips
```

The direction should not matter.

Both:

```text
4000 → 3985
```

and:

```text
3985 → 4000
```

must produce:

```text
$15 price distance
150 pips
```

---

# 7. XAUUSD Contract Specification

Version 1 supports only XAUUSD.

Use:

```js
const instruments = {
    XAUUSD: {
        symbol: "XAUUSD",
        name: "Gold",
        contractSize: 100,
        pipSize: 0.10,
        minLot: 0.01,
        lotStep: 0.01
    }
};
```

Do not allow users to edit these values in version 1.

Structure the code so more instruments can easily be added later.

---

# 8. Calculation Logic

IMPORTANT:

Use the following exact calculation model.

### Risk Amount

```text
riskAmount = accountBalance × riskPercent / 100
```

Example:

```text
500 × 5 / 100
= $25
```

---

### Price Distance

If SL is entered in pips:

```text
priceDistance = slPips × pipSize
```

Example:

```text
150 × 0.10
= $15
```

---

### Loss Per 1.00 Lot

XAUUSD contract size:

```text
100 oz
```

Therefore:

```text
lossPerOneLot = priceDistance × contractSize
```

Example:

```text
$15 × 100
= $1,500
```

---

### Exact Lot Size

```text
exactLot = riskAmount / lossPerOneLot
```

Example:

```text
$25 / $1,500
= 0.0166667
```

Display:

```text
0.0167
```

---

# 9. MT5 Lot Size

MT5 uses a minimum lot and lot step.

For XAUUSD:

```text
Minimum Lot = 0.01
Lot Step = 0.01
```

The executable lot must NEVER be rounded upward because that can exceed the user's intended risk.

Use:

```text
mt5Lot = floor(exactLot / lotStep) × lotStep
```

Example:

```text
exactLot = 0.0166667

floor(0.0166667 / 0.01) × 0.01
= 0.01
```

Therefore:

```text
Exact Lot
0.0167

MT5 Lot
0.01
```

---

# 10. Actual Risk

After determining the MT5 lot size, calculate the actual monetary risk.

```text
actualRisk = mt5Lot × lossPerOneLot
```

Example:

```text
0.01 × $1,500
= $15
```

Also calculate:

```text
actualRiskPercent =
actualRisk / accountBalance × 100
```

Example:

```text
$15 / $500 × 100
= 3%
```

Display:

```text
Actual Risk
$15.00

Actual Risk %
3.00%
```

This is important because the user needs to see the difference between the desired risk and the actual risk after MT5 lot rounding.

---

# 11. Example Result

With:

```text
Account Balance: $500
Risk: 5%
SL: 150 pips
```

The application must display:

```text
Risk Amount
$25.00

Price Distance
$15.00

Exact Lot
0.0167

MT5 Lot
0.01

Actual Risk
$15.00

Actual Risk %
3.00%
```

This example must be correct.

---

# 12. Minimum Lot Warning

If the calculated exact lot is below `0.01`, do NOT silently pretend the desired risk can be achieved.

Example:

```text
Account Balance: $500
Risk: 1%
SL: 150 pips
```

Risk amount:

```text
$5
```

Exact lot:

```text
0.0033
```

Since the minimum lot is:

```text
0.01
```

show:

```text
Exact Lot
0.0033

MT5 Lot
0.01
```

And display a small warning:

```text
Minimum lot exceeds your selected risk.
```

Calculate the actual risk at 0.01 lot and display it.

Do not automatically increase the risk without telling the user.

---

# 13. Validation

Handle:

* Empty input
* Zero
* Negative numbers
* Extremely large values
* Invalid decimal values

Do not display:

```text
NaN
Infinity
undefined
```

If Account Balance <= 0:

```text
Enter a valid account balance.
```

If Risk <= 0:

```text
Enter a valid risk percentage.
```

If SL <= 0:

```text
Enter a valid stop loss.
```

Keep validation messages short.

---

# 14. Result Hierarchy

The most important result should be:

```text
MT5 LOT
0.01
```

Make this visually prominent.

Below it:

```text
Exact Lot
0.0167

Actual Risk
$15.00

Actual Risk %
3.00%
```

The user should immediately know what lot size to enter into MT5.

---

# 15. Instrument Information

At the bottom, add a very compact specification section:

```text
XAUUSD

Contract Size     100 oz
Pip Size          0.10
Minimum Lot       0.01
Lot Step          0.01
```

Keep it subtle and compact.

---

# 16. Responsive Design

Desktop:

Use a compact centered layout.

Mobile:

Inputs should become full width.

Do not create horizontal scrolling.

The calculator should work comfortably on a 320px-wide screen.

Inputs should have sufficiently large touch targets.

---

# 17. Technical Requirements

Use:

* HTML
* CSS
* Vanilla JavaScript

No React.

No backend.

No database.

No API.

No external dependencies.

The calculator must work completely offline.

Organize the code cleanly:

```text
index.html
style.css
script.js
```

Keep the calculation logic separate from UI rendering.

Create reusable functions such as:

```js
calculateRiskAmount()
calculatePriceDistance()
calculateLossPerLot()
calculateExactLot()
calculateMt5Lot()
calculateActualRisk()
```

---

# 18. Future Extensibility

Although version 1 only supports XAUUSD, write the architecture so additional instruments can later be added.

Future examples:

```text
XAUUSD
EURUSD
GBPUSD
USDJPY
NAS100
US30
BTCUSD
```

Do NOT implement these instruments now.

Only XAUUSD should appear in the UI.

---

# 19. Important Calculation Principle

The calculator is based on this concept:

```text
Account Balance
       ↓
Risk %
       ↓
Maximum Risk $
       ↓
Stop Loss Distance
       ↓
Loss per 1 Lot
       ↓
Exact Lot Size
       ↓
MT5 Lot Step
       ↓
Actual Lot Size
       ↓
Actual Risk
```

The application must prioritize **risk protection**.

Never round the final MT5 lot upward.

---

# 20. Final UI Requirements

The final UI should feel like:

* A professional trading calculator
* Minimal
* Flat
* Fast
* Clean
* Precise
* No visual clutter

Use restrained typography.

Use one accent color only for the primary result.

Use subtle borders instead of shadows.

Keep the interface compact.

Do not add unnecessary features.

The first version should focus entirely on getting the **XAUUSD lot size calculation** correct and making the result immediately readable.
