This prompt adds ~4 large features. Building everything in one pass risks broken edits across 30+ files. I'm proposing a phased build, each phase shippable on its own. Tell me which phase to start — or say "all phases in order" and I'll execute sequentially.

## Phase 1 — Foundation (DB + Expenses + FAB)

**Migrations**
- `expenses` table (all fields per spec) + RLS + GRANTs
- `expense_categories` table + RLS + seed-on-signup trigger
- Add `is_imported`, `import_batch_id`, `fingerprint_hash` columns to `master_transactions` if missing
- Index on `transaction_fingerprints(user_id, fingerprint)` for bulk lookup

**FAB component** (`src/components/QuickEntryFab.tsx`)
- Fixed bottom-right button, mounted once in `_authenticated.tsx` layout
- Dialog/Sheet (Sheet on mobile, Dialog on desktop) — pre-rendered, controlled by `open` state
- Tabs: Expense (Quick/Detailed), Income, Investment, Transfer, CC Bill, EMI
- Each tab is a compact form reusing existing form logic

**Expenses module**
- Route `/expenses` with filter, donut chart (Recharts), month-over-month KPI, category pill filter
- Sidebar entry between Passbook and Income
- Expenses surfaced in Passbook query (union with master_transactions)

## Phase 2 — UPI parsing + Transaction Detail

- `src/lib/upi.ts` with `parseUPIDisplay(upiId, paidToName)` — title-case heuristic
- Apply in Passbook description cell + PDF parser
- Info button (ⓘ) on every passbook row → Sheet (right on desktop, bottom on mobile) with full transaction details, copyable UPI ID, fingerprint, import batch link

## Phase 3 — PDF Import system

**Parser** (`src/lib/pdf-import/`)
- Bank-specific column maps for HDFC/SBI/ICICI/Axis/Kotak + generic header-detect fallback
- Uses `pdfjs-dist` (already common) for text extraction; password attempts done client-side
- Password pattern memory in `localStorage` keyed by bank
- Web Worker for parsing >500 transactions
- Fingerprint = SHA256(user+account+date+amount+normalized_desc[:40])

**Import flow modal** (6 steps as spec'd): bank/account select → decrypt → parse with progress → bulk dedup (single `IN (...)` query) → confirmation w/ coverage timeline → batch insert (50/batch) with live progress
- Writes to `master_transactions` + `transaction_fingerprints` + `import_batches`

**Entry points**: button on Passbook header + Bank Account detail page

## Phase 4 — Import Status page

- Route `/import-status`, sidebar entry under Passbook
- Account coverage table (status badge based on `last_imported_until` age)
- Import history list (expandable, with Undo flow requiring "CONFIRM" typed)
- Gap detector: SQL function computing date gaps per account from `import_batches.coverage_*`
- Storage stats footer

## Phase 5 — Passbook polish + PDF/Excel export

- Export dropdown: CSV (existing), PDF, Excel
- PDF generated client-side with `jspdf` + `jspdf-autotable` (cover page, monthly grouped tables, summary page); for >500 rows offload to a `createServerFn` returning base64
- Excel via `xlsx` package
- Summary bar gets "Manual Entries: N" stat
- All amounts pushed through `inr()` from `src/lib/format.ts` (already exists)
- "Cash" pseudo-account rendering for null `paid_from_account_id`

## Technical notes

- All new server logic = `createServerFn` (auth-middleware), NOT edge functions
- Batch insert pattern: `supabase.from('x').insert(batch)` in 50-row chunks
- Fingerprint dedup = exactly 2 queries (fetch existing, in-memory diff)
- FAB modal pre-mounted; `useState` reset on close transition end
- Reuse existing `<DataTable>`, `<AmountDisplay>`, `<EmptyState>`, `<CategoryBadge>`, `<StatusBadge>` components

## Recommended order

Phase 1 → Phase 3 → Phase 2 → Phase 4 → Phase 5. (Import system unblocks Status page; UPI/Detail polish before export ensures PDFs use clean names.)

**Reply with**: "all phases in order", or "phase 1", "phase 1+2", etc. I'll execute and stop at the end of the requested phase for review before continuing.