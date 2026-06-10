# Edward & Christie — Site Rental Bill Creation System

A self-contained invoice / billing system for the E&C machinery-rental fleet.
**No installation, no server, no internet needed** — open `index.html` in any
modern browser (double-click it) and start billing.

## What it does

| Feature | Details |
|---|---|
| Documents | Tax **Invoice**, **Proforma Invoice**, **Quotation** — switchable, each with its own auto-generated reference sequence (`INV/2026/06/001` …) |
| Machine Rental Calculator | Pick any of the **518 fleet machines** or **36 portable equipment** items — registration, type, E&C number and price auto-fill |
| **Rate Basis tick system** | **FULLY WET** (vehicle + driver + fuel) / **WET** (vehicle + driver, customer fuels) / **DRY** (vehicle only) |
| Billing methods | **Hourly** (min 120 hrs) / **Per-KM** (min 3,000 km) / **Per-Day** (min 1 day) — all three work for fleet machines; portable plant is day-hire |
| **Smart Rate Matrix** | Picking a machine shows a live 3 × 3 price grid (basis × billing method). **Tap any price to apply it** — basis, billing method and rate are set in one tap. Hand-edited rates get a `CUSTOM` badge; tap the cell again to restore the list rate |
| Minimum-guarantee billing | Bills `max(actual, minimum)` and adds an explanatory shortfall/excess note line |
| Daily timesheet log | Optional 31-day hour/km log that prints as a timesheet annex page |
| Totals | SSCL 2.5% + VAT 18% (both editable) |
| Output | Print / Save as PDF (A4, auto-scaled) |

## How the prices are derived

List rates come from `data/Fleet_Rental_Prices_2026.xlsx` and are embedded in
`index.html` by the build script. Per unit:

| Tier | Hourly | Per-Day (4-hour basis) | Per-KM (transport units) |
|---|---|---|---|
| FULLY WET | Excel *Hourly WET* | Excel *Daily WET (4h)* | per-km list rate |
| WET (driver only) | `DRY + operator/h × 1.2` → rounded to Rs. 50 | `Daily DRY + operator/h × 4 × 1.2` → rounded to Rs. 50 | `DRY + (WET−DRY) × op/(fuel+op)` → rounded to Rs. 5 |
| DRY | Excel *Hourly DRY* | Excel *Daily DRY (4h)* | per-km list rate |

- Operator and fuel costs per hour come from the Excel **Engineering Cost**
  sheet (joined by E&C No.). The 44 units without an engineering row use their
  category average (then the global average) and are marked **`est.`** in the
  rate matrix.
- The WET tier is always clamped into `[DRY, FULLY WET]`. On operator-dominated
  cheap transport (and self-ridden motor bicycles, operator cost 0) WET can
  legitimately equal one of the bounds.
- Per-km list rates are maintained directly in `index.html`’s data block
  (they are not in the Excel); the build script preserves them across rebuilds.
- Portable equipment is 2-tier only: WET (incl. fuel & operator) / DRY (bare hire).
- All rates exclude VAT.

## Updating prices

1. Edit `data/Fleet_Rental_Prices_2026.xlsx` (Fleet Pricing / Engineering Cost /
   Portable Equipment Rates sheets — keep the row order).
2. Regenerate the embedded data:

   ```bash
   python3 tools/build_fleet_data.py            # dry-run report
   python3 tools/build_fleet_data.py --write    # apply to index.html
   ```

3. Validate:

   ```bash
   node tests/check.mjs                         # data invariants + golden values
   ```

The script is idempotent and refuses to write if the Excel row order no longer
matches the embedded array (positional merge is asserted per row on
registration + E&C number).

## Tests

```bash
node tests/check.mjs    # fast, no dependencies — data + function presence checks
node tests/smoke.mjs    # full browser test (needs playwright + chromium), e.g.:
# PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers NODE_PATH=$(npm root -g) node tests/smoke.mjs
```

Manual QA (60 seconds): open `index.html` → **🚜 Machine Rental Calc** → type a
machine (e.g. `LB-22`) and pick the suggestion → the rate matrix appears →
tap *WET × Per-Day* → day rate fills with the list price → edit the rate →
`CUSTOM` badge appears → **Add to Document** → the invoice gains a section
banner + a rental line that names the basis (e.g.
`Equipment Rental — Per-Day, WET — operator incl., fuel by customer, …`).

## Repository layout

```
index.html                          the entire app (UI + data, self-contained)
data/Fleet_Rental_Prices_2026.xlsx  source price workbook
tools/build_fleet_data.py           Excel → embedded data pipeline (stdlib only)
tests/check.mjs                     data-invariant checks
tests/smoke.mjs                     end-to-end browser test
```
