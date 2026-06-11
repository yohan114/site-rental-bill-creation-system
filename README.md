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
| **Drafts & autosave** | Documents save automatically while you type (plus 💾 Save Draft); the toolbar pill shows `DRAFT · saved 10:42`. Closing the browser loses nothing — the open document is restored on the next launch |
| **Finalize (hard lock)** | ✅ Finalize permanently locks an invoice — view, print and ⧉ Duplicate-as-Draft only. The REF sequence number is committed **only at finalize** (printing a draft never burns a number) |
| **📁 Document Library** | Every saved document, grouped by month with DRAFT/FINAL badges, customer, totals and monthly revenue subtotals. Search, reopen, print, duplicate; drafts can be deleted, finals are the permanent ledger |
| **Backup** | ⬇ Export Backup downloads all documents + numbering counters as one JSON file; ⬆ Import merges it back (never wipes — newer copy wins, finals are never downgraded) |

## How the document lifecycle works

1. Work normally — everything autosaves as a **DRAFT** (browser localStorage, ~400+ documents capacity, usage meter in the library).
2. Reopen any draft from **📁 Documents** to edit, add items, or print a preview.
3. When the invoice is issued, press **✅ Finalize**: the document is validated, its REF number is committed, and it locks forever — that month's archive stays trustworthy.
4. Need to revise a finalized invoice? **⧉ Duplicate as Draft** gives an editable copy with a fresh REF.
5. Take an **Export Backup** regularly (and before changing computers): documents live in this browser's storage only. Two browser tabs editing at once is unsupported (last write wins).

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
   Portable Equipment Rates sheets — keep the row order). Catalogue items that
   are hired out but not in the workbook (Light Plant, Concrete Mixer, …) live
   in the `EXTRA_PORTABLE` list at the top of `tools/build_fleet_data.py` —
   add or re-price them there.
2. Regenerate the embedded data:

   ```bash
   python3 tools/build_fleet_data.py            # dry-run report
   python3 tools/build_fleet_data.py --write    # apply to index.html
   ```

3. Validate:

   ```bash
   node tests/check.mjs                         # data invariants + golden values
   ```

4. Export the printable 3-tier rate card (optional, needs `pip install openpyxl`):

   ```bash
   python3 tools/export_rate_matrix.py          # → data/Fleet_Rental_Rate_Matrix_2026.xlsx
   ```

   `data/Fleet_Rental_Rate_Matrix_2026.xlsx` lists every unit with all three
   tiers across Hourly / Daily / Per-KM — exactly the prices the invoice
   system quotes (the workbook is generated from the embedded data).

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
index.html                                the entire app (UI + data, self-contained)
data/Fleet_Rental_Prices_2026.xlsx        source price workbook
data/Fleet_Rental_Rate_Matrix_2026.xlsx   generated 3-tier rate card (system prices)
tools/build_fleet_data.py                 Excel → embedded data pipeline (stdlib only)
tools/export_rate_matrix.py               embedded data → rate-card Excel (openpyxl)
tests/check.mjs                           data-invariant checks
tests/smoke.mjs                           end-to-end browser test
```
