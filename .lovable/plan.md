
# FamilyKhata — Overhaul Plan

Big scope. Splitting into 6 phases so each ships working. Nothing existing gets deleted unless replaced.

---

## Phase 1 — Foundations (theme + Indian number formatting + FAB position + double-close)

**New light, colorful theme** — hand-picked, non-traditional palette:
- Background `#fafaf7` (warm paper), surface `#ffffff`, ink `#1a1d2e`
- Accents rotated per module: coral `#ff6b6b` (income), teal `#14b8a6` (investments), amber `#f59e0b` (TDS), violet `#8b5cf6` (expenses), sky `#3b82f6` (transfers), rose `#ec4899` (business)
- Soft tinted card backgrounds (`#fff5f5`, `#f0fdfa`, `#faf5ff`…) — each module gets its own hue
- Rounded 14px, subtle shadows, no dark surfaces anywhere

**Indian comma formatting everywhere**
- Fix `inr()` in `src/lib/format.ts` (already uses `en-IN`, but audit all raw `.toLocaleString`, `toFixed`, and manual `₹${n}` usages across all routes and force `inr()`).

**FAB position**
- Desktop: bottom-LEFT floating (24px from left, 24px from bottom).
- Mobile: keep bottom-center.

**Double close button bug**
- Audit every `Dialog`/`Sheet`. Root cause: custom header adds an X while shadcn `DialogContent` already renders one. Remove all manual X icons inside dialog headers.

---

## Phase 2 — Form UX: Quick Expense, Income, Investments

**Quick Expense (rename, merge, enhance)**
- Rename to just "Add Expense" — one unified form.
- Add fields from detailed version: payment method dropdown, paid-from bank account, receipt number, note.
- **Paid-from**: has a `+ Add new` inline option that opens a mini form to create a new bank account/wallet on the fly.
- **Paid-to autosuggest**: as user types 2+ chars, suggest from previous `paid_to_name` entries (query `expenses` for distinct names, cache). Auto-remember every new name.

**Income form**
- **Income type**: dropdown + `+ Add new` inline option (persist custom types per user in a new `income_types` lookup table).
- **TDS auto-calc**: when a section is picked, if that section has a standard flat rate in `tds-constants.ts`, auto-fill the TDS % and compute TDS + net amount live. Allow manual override.

**Investment form**
- **Investment type**: dropdown + `+ Add new`.
- **Amount split** (partial rollover): three fields
  - Total invested = auto (Rollover + Fresh top-up)
  - Rollover amount (from a linked maturity, defaults to matured amount)
  - Fresh top-up (new money from bank)
- Show a live "Fresh money coming from bank X: ₹Y" line.
- **Per-type field packs** (dynamic, appear only when selected):
  - FD: FD number, tenure, rate, compounding, maturity date, auto-calc maturity amount
  - RD: monthly installment, tenure, rate
  - Mutual Fund: folio, scheme name, units, NAV, SIP/lumpsum
  - Stocks: ISIN, ticker, exchange, qty, avg price, broker
  - Bonds: ISIN, coupon %, YTM, face value
  - PPF/EPF/SSY/NPS: institution, PRAN/account no
  - Gold: form (coin/bar/ETF), weight (g), purity
  - Real Estate: address, area, registration date

---

## Phase 3 — PDF Parser v2 (major rewrite)

The current heuristic parser fails on multi-column, small-amount, and credit-side entries. Rewriting from scratch as a robust multi-bank engine.

**Architecture**
```text
extract.ts (unchanged) → pageLayout.ts (NEW: column detection via X-coordinates)
                       → bankProfiles.ts (NEW: per-bank column maps + row regex)
                       → rowAssembler.ts (NEW: multi-line txn stitching)
                       → validators.ts (NEW: running-balance reconciliation)
                       → parsers.ts (thin dispatcher)
```

**Fixes for the reported bugs**
- **Missing credits**: detect column headers (Withdrawal/Deposit/Credit/Debit/Dr/Cr) via first-page X-positions, then bin each row's amount tokens by column X — not by "last token = balance".
- **Missing small amounts** (< ₹30): current AMOUNT_RE requires commas or ≥1 comma group. New regex accepts any decimal `\d+\.\d{2}` regardless of comma grouping.
- **Multi-line descriptions**: stitch continuation rows within Y-tolerance of a dated row.
- **Balance reconciliation**: after parsing, walk txns forward; if computed balance ≠ printed balance for >5% of rows, flag the batch and try alternate column mapping.

**Bank profiles shipped v2**
- HDFC, SBI, ICICI, Axis, Kotak, IDFC First, Yes Bank, PNB (all common formats)
- Each profile: header keywords, column X-band map, date regex, amount column indices.
- Generic fallback rewritten with column-detection instead of positional guessing.

**UI additions to Import dialog**
- Preview table now shows: parsed row + confidence badge (green/amber/red based on balance-reconciliation match).
- "Balance mismatch" warning banner if reconciliation fails; user can still import but rows are marked `needs_review`.
- Post-import summary: "42 imported, 3 flagged for review".

---

## Phase 4 — Dashboard v2 (Command Center + Analyst Grid hybrid)

Kill current charts. Build a two-tab dashboard:

**Tab 1: Command Center**
- Hero Net-Worth card (huge number, sparkline last 12 months, MoM delta)
- **Sankey**: Income → Bank buckets → Deployed (Investments / EMIs / CC / Expenses / Surplus). Interactive: hover to isolate, click to drill.
- **Calendar heatmap**: 365-day cash-flow intensity (GitHub-style), color by net surplus per day.
- 4 drill-down KPI tiles: click any → filtered view.
- Upcoming 90-day timeline (existing, restyled).

**Tab 2: Analyst Grid**
- Net-worth **waterfall** (opening → income → expenses → investments → closing per month).
- Investment allocation **treemap** (by type → by member → by institution).
- TDS gauge (paid vs. estimated liability, FY progress).
- Family member matrix (income / invested / TDS / balance, sortable).
- Bank health strip (each account: balance, 30d in/out, sparkline).

All charts: recharts + custom SVG for sankey/treemap/heatmap. All interactive (hover, click-to-filter, legend toggles).

---

## Phase 5 — Transaction Drawer + Passbook polish

**Detail drawer** (side sheet on every passbook row):
- Full row: date/time, amount (color-coded), category, member, description
- **Copyable** buttons: UPI ID, reference no, fingerprint hash — each with a copy icon
- Payment method breakdown (UPI parser output)
- "Imported from batch → [link to /import-status/batch-id]" when applicable
- Related transactions (same fingerprint prefix / same UPI ID)
- Edit + delete actions (with existing confirm dialogs)

**Passbook polish**
- Add info-button on every row → opens drawer
- Cash pseudo-account for entries with no `bank_account_id`
- Manual vs Imported filter chip
- Confidence badge on imported rows (from Phase 3)

---

## Phase 6 — Cleanup

- Audit every module for the double-close, dark-theme leftovers, and comma-less amount displays.
- Regression pass on the auth flow.
- Type-check + build verify.

---

## Technical notes

- New tables: `income_types`, `investment_types`, `payee_suggestions` (all user-scoped with RLS + GRANTs). One migration at start of Phase 2.
- New `Combobox` component (shadcn pattern) for "dropdown + add new + autosuggest" — reused across all three forms.
- New `format.ts` helpers audited: `inr()` already correct; add `inrInput()` for input-field live formatting.
- Sankey/treemap/heatmap components under `src/components/charts/`.
- Bank parser test fixtures under `src/lib/pdf-import/__fixtures__/` (redacted PDF text) so regressions are catchable.
- Given the scope, I'll ship phases in order and confirm each is working before starting the next.

---

**Starting order**: Phase 1 (theme + FAB + double-X) is fastest and unblocks visual review. Then Phase 2 (forms), Phase 3 (parser — the biggest single lift), Phase 4 (dashboard), Phase 5 (drawer), Phase 6 (polish).

Approve to start with Phase 1.
