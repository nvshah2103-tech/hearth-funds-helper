// Column-aware Indian bank statement parser (v2).
// Strategy:
//   1. Locate a header row containing Date + (Debit|Withdrawal) + (Credit|Deposit) + Balance.
//   2. Record the X-band of each header column.
//   3. For each subsequent line whose first token is a date, extract amount
//      tokens and bin each into the nearest column by X-coordinate.
//   4. Multi-line stitching: lines with no date and no amounts attach to
//      the previous transaction's description.
//   5. Reconcile against printed running balance to compute a confidence score.
//
// This correctly handles bank quirks the v1 parser mishandled:
//   • credit-side entries were dropped (treated last token as balance without
//     checking column)
//   • amounts under ~₹30 (no comma group) were rejected by the amount regex
//   • multi-line "particulars" wrapped rows were skipped
import type { ExtractedLine, LineToken } from "./extract";

export type ParsedTxn = {
  date: string;          // YYYY-MM-DD
  description: string;
  debit: number;
  credit: number;
  balance: number | null;
  reference: string | null;
  confidence: "high" | "medium" | "low";
  needsReview: boolean;
};

export type BankKey = "HDFC" | "SBI" | "ICICI" | "AXIS" | "KOTAK" | "IDFC" | "YES" | "PNB" | "GENERIC";

/* ------------------------------ date parsing ------------------------------ */

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};
const DATE_RES = [
  /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/,     // 01/02/2024
  /^(\d{1,2})[ \-]([A-Za-z]{3})[ \-,]?(\d{2,4})$/, // 01 Feb 24
  /^(\d{4})-(\d{2})-(\d{2})$/,                     // 2024-02-01
];
function normYear(y: string) {
  if (y.length !== 2) return y;
  return (Number(y) >= 70 ? "19" : "20") + y;
}
export function parseDateToken(tok: string): string | null {
  const s = tok.trim().replace(/,+$/, "");
  let m = s.match(DATE_RES[0]);
  if (m) return `${normYear(m[3])}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(DATE_RES[1]);
  if (m) {
    const mm = MONTHS[m[2].toLowerCase()];
    if (mm) return `${normYear(m[3])}-${mm}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(DATE_RES[2]);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** Also tries date joined with adjacent tokens (e.g. "01" "Feb" "2024"). */
function detectLeadingDate(tokens: LineToken[]): { date: string; endIndex: number } | null {
  if (!tokens.length) return null;
  // Try first token
  let d = parseDateToken(tokens[0].s);
  if (d) return { date: d, endIndex: 1 };
  // Try first 2 tokens joined
  if (tokens.length >= 2) {
    d = parseDateToken(tokens[0].s + " " + tokens[1].s);
    if (d) return { date: d, endIndex: 2 };
  }
  // Try first 3 tokens joined
  if (tokens.length >= 3) {
    d = parseDateToken(tokens.slice(0, 3).map((t) => t.s).join(" "));
    if (d) return { date: d, endIndex: 3 };
  }
  return null;
}

/* ------------------------------ amount parsing ---------------------------- */

/** Accepts:
 *   1,23,456.78 / 1234.56 / 12.50 / 5.00 / 3,000 / 100 / 25.75Cr / 25.75 Dr
 *  Standalone token check — must be a pure amount, not embedded in text.
 */
const AMOUNT_TOKEN = /^-?(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?(?:\s?(Cr|Dr|CR|DR))?$/;

export function isAmountToken(s: string): boolean {
  const t = s.trim().replace(/^[₹Rs.]+/, "");
  return AMOUNT_TOKEN.test(t);
}
export function amountValue(s: string): number {
  const t = s.trim().replace(/^[₹Rs.]+/, "").replace(/\s?(Cr|Dr|CR|DR)$/i, "").replace(/,/g, "");
  const n = Number(t);
  return isFinite(n) ? n : 0;
}
export function amountSign(s: string): "cr" | "dr" | "" {
  const m = s.trim().match(/(Cr|Dr|CR|DR)$/);
  return m ? (m[1].toLowerCase() as "cr" | "dr") : "";
}

/* ------------------------------ header detection -------------------------- */

type ColKey = "date" | "desc" | "debit" | "credit" | "balance" | "ref";
type ColHeader = { key: ColKey; xStart: number; xEnd: number; xCenter: number };

const HEADER_KW: Record<ColKey, RegExp> = {
  date: /^(txn|value|posting|effective|entry)?\.?\s*(date|dt)$/i,
  desc: /^(particulars|narration|description|remarks|details|transaction\s+details|transactionparticulars)$/i,
  debit: /^(debit|withdrawal|withdrawals|withdrawal\s+amt|withdrawal\s+amount|dr|dr\.|paid\s*out|out\s*flow)$/i,
  credit: /^(credit|deposit|deposits|deposit\s+amt|deposit\s+amount|cr|cr\.|paid\s*in|in\s*flow)$/i,
  balance: /^(balance|closing\s+balance|running\s+balance|bal|bal\.|available\s+balance)$/i,
  ref: /^(chq|ref|reference|utr|cheque|chq\.\/ref)\.?\s*(no|number)?$/i,
};

function detectHeaderRow(lines: ExtractedLine[]): ColHeader[] | null {
  const scan = Math.min(lines.length, 120);
  for (let li = 0; li < scan; li++) {
    const line = lines[li];
    // header rows almost never contain a date at the start
    if (parseDateToken(line.tokens[0]?.s ?? "")) continue;

    // Try token-level, then also try 2-token combos (e.g. "Withdrawal" + "Amount")
    const hits: ColHeader[] = [];
    const marked = new Set<number>();
    for (let i = 0; i < line.tokens.length; i++) {
      if (marked.has(i)) continue;
      const t = line.tokens[i];
      const t2 = line.tokens[i + 1];
      const joined2 = t2 ? `${t.s} ${t2.s}` : "";
      for (const [key, re] of Object.entries(HEADER_KW) as [ColKey, RegExp][]) {
        if (re.test(t.s.trim())) {
          hits.push({ key, xStart: t.x, xEnd: t.x + t.width, xCenter: t.x + t.width / 2 });
          marked.add(i);
          break;
        }
        if (t2 && re.test(joined2.trim())) {
          hits.push({
            key,
            xStart: t.x,
            xEnd: t2.x + t2.width,
            xCenter: (t.x + t2.x + t2.width) / 2,
          });
          marked.add(i); marked.add(i + 1);
          break;
        }
      }
    }

    const keys = new Set(hits.map((h) => h.key));
    // Valid header: date + balance + (debit OR credit)
    if (keys.has("date") && keys.has("balance") && (keys.has("debit") || keys.has("credit"))) {
      // Deduplicate: keep first occurrence per key
      const seen = new Set<ColKey>();
      const uniq: ColHeader[] = [];
      for (const h of hits) if (!seen.has(h.key)) { seen.add(h.key); uniq.push(h); }
      return uniq.sort((a, b) => a.xStart - b.xStart);
    }
  }
  return null;
}

/* ------------------------------ bank detection ---------------------------- */

export function detectBank(lines: ExtractedLine[]): BankKey {
  const head = lines.slice(0, 40).map((l) => l.text.toLowerCase()).join(" ");
  if (head.includes("hdfc bank")) return "HDFC";
  if (head.includes("state bank") || head.includes("sbi")) return "SBI";
  if (head.includes("icici bank")) return "ICICI";
  if (head.includes("axis bank")) return "AXIS";
  if (head.includes("kotak")) return "KOTAK";
  if (head.includes("idfc first") || head.includes("idfc bank")) return "IDFC";
  if (head.includes("yes bank")) return "YES";
  if (head.includes("punjab national") || head.includes(" pnb ")) return "PNB";
  return "GENERIC";
}

/* ------------------------------ main parser ------------------------------- */

function nearestColumn(x: number, cols: ColHeader[]): ColHeader | null {
  if (!cols.length) return null;
  let best = cols[0]; let bestD = Math.abs(x - best.xCenter);
  for (const c of cols) {
    const d = Math.abs(x - c.xCenter);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

/** Row -> {debit, credit, balance} via column-aware binning. */
function assignAmountsByColumn(
  amountTokens: { tok: LineToken; val: number; sign: "cr" | "dr" | "" }[],
  cols: ColHeader[],
): { debit: number; credit: number; balance: number | null } {
  let debit = 0, credit = 0;
  let balance: number | null = null;

  // Balance is (almost) always the right-most amount, whatever the layout.
  // But: if we have a proper header, prefer the token nearest the "balance" column.
  const balCol = cols.find((c) => c.key === "balance");
  const debitCol = cols.find((c) => c.key === "debit");
  const creditCol = cols.find((c) => c.key === "credit");

  if (balCol) {
    // Pick the token whose x is closest to balance-col AND is right-most among nearby.
    let bestIdx = -1; let bestD = Infinity;
    for (let i = 0; i < amountTokens.length; i++) {
      const d = Math.abs(amountTokens[i].tok.x + amountTokens[i].tok.width / 2 - balCol.xCenter);
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    if (bestIdx >= 0) {
      balance = amountTokens[bestIdx].val;
      amountTokens.splice(bestIdx, 1);
    }
  } else if (amountTokens.length) {
    balance = amountTokens[amountTokens.length - 1].val;
    amountTokens.pop();
  }

  for (const a of amountTokens) {
    if (a.sign === "cr") { credit += a.val; continue; }
    if (a.sign === "dr") { debit += a.val; continue; }
    if (debitCol && creditCol) {
      const nearest = nearestColumn(a.tok.x + a.tok.width / 2, [debitCol, creditCol]);
      if (nearest?.key === "credit") credit += a.val;
      else debit += a.val;
    } else if (debitCol) {
      debit += a.val;
    } else if (creditCol) {
      credit += a.val;
    } else {
      // No header: fall back to positional heuristic – last amount was balance
      // (already popped), so remaining are txn amounts.
      // If 2 remain → [debit, credit] pattern; pick non-zero.
      debit += a.val;
    }
  }
  return { debit, credit, balance };
}

/** Extract all amount tokens from a line (with x-coord + sign). */
function extractAmounts(tokens: LineToken[], startIndex: number) {
  const out: { tok: LineToken; val: number; sign: "cr" | "dr" | "" }[] = [];
  for (let i = startIndex; i < tokens.length; i++) {
    const t = tokens[i];
    const s = t.s.trim();
    // Sometimes cr/dr sits as a separate next token
    if (isAmountToken(s)) {
      let sign = amountSign(s);
      let val = amountValue(s);
      const nxt = tokens[i + 1];
      if (!sign && nxt && /^(Cr|Dr|CR|DR)$/.test(nxt.s.trim())) {
        sign = nxt.s.trim().toLowerCase() as "cr" | "dr";
        i++;
      }
      out.push({ tok: t, val, sign });
    }
  }
  return out;
}

/** Build description from tokens between "after-date" and "before-first-amount". */
function buildDescription(tokens: LineToken[], dateEndIdx: number, cols: ColHeader[] | null): string {
  const balCol = cols?.find((c) => c.key === "balance");
  const debitCol = cols?.find((c) => c.key === "debit");
  const creditCol = cols?.find((c) => c.key === "credit");
  const amountStartX = Math.min(
    ...([debitCol?.xStart, creditCol?.xStart, balCol?.xStart].filter((v): v is number => v != null)),
  );

  const words: string[] = [];
  for (let i = dateEndIdx; i < tokens.length; i++) {
    const t = tokens[i];
    if (isFinite(amountStartX) && t.x + t.width * 0.5 >= amountStartX - 4) break;
    if (isAmountToken(t.s.trim())) break;
    words.push(t.s);
  }
  return words.join(" ").replace(/\s+/g, " ").trim().slice(0, 200);
}

/* ------------------------------ public API -------------------------------- */

export function parseStatement(lines: ExtractedLine[]): ParsedTxn[] {
  const cols = detectHeaderRow(lines);
  const out: ParsedTxn[] = [];
  let last: ParsedTxn | null = null;
  let lastLineY = -1;
  let lastPage = -1;

  for (const l of lines) {
    if (!l.tokens.length) continue;

    const dateHit = detectLeadingDate(l.tokens);
    if (!dateHit) {
      // Continuation? Attach if directly under previous txn (small Y delta, same page)
      // and short & non-numeric.
      if (
        last &&
        l.page === lastPage &&
        Math.abs(l.y - lastLineY) < 30 &&
        !l.tokens.some((t) => isAmountToken(t.s.trim())) &&
        l.text.length < 120
      ) {
        last.description = (last.description + " " + l.text).replace(/\s+/g, " ").trim().slice(0, 200);
        lastLineY = l.y;
      }
      continue;
    }

    const amts = extractAmounts(l.tokens, dateHit.endIndex);
    if (!amts.length) continue; // date-only header row (e.g. daily total)

    const desc = buildDescription(l.tokens, dateHit.endIndex, cols);
    const { debit, credit, balance } = assignAmountsByColumn(amts.slice(), cols ?? []);

    // Reference: any long digit run in description
    const refMatch = desc.match(/\b(\d{8,})\b/);

    const txn: ParsedTxn = {
      date: dateHit.date,
      description: desc || "(no description)",
      debit,
      credit,
      balance,
      reference: refMatch ? refMatch[1] : null,
      confidence: "high",
      needsReview: false,
    };
    if (debit === 0 && credit === 0) {
      txn.confidence = "low";
      txn.needsReview = true;
    }
    out.push(txn);
    last = txn;
    lastLineY = l.y;
    lastPage = l.page;
  }

  // ------- Reconciliation pass: verify running balance -------
  reconcileConfidence(out);

  // Filter out zero rows we still couldn't classify
  return out.filter((t) => t.debit > 0 || t.credit > 0);
}

/** Walk the transactions in file order; where balance is present, verify that
 *  prev_balance + credit - debit ≈ current_balance. Bump confidence based on
 *  match ratio. */
function reconcileConfidence(txns: ParsedTxn[]) {
  let matches = 0;
  let checks = 0;
  for (let i = 1; i < txns.length; i++) {
    const prev = txns[i - 1].balance;
    const cur = txns[i].balance;
    if (prev == null || cur == null) continue;
    const expected = prev + txns[i].credit - txns[i].debit;
    checks++;
    if (Math.abs(expected - cur) < 1) matches++;
  }
  const ratio = checks ? matches / checks : 1;
  for (const t of txns) {
    if (ratio >= 0.9) t.confidence = "high";
    else if (ratio >= 0.6) t.confidence = "medium";
    else { t.confidence = "low"; t.needsReview = true; }
  }
}

export function summarizeCoverage(txns: ParsedTxn[]): { from: string | null; to: string | null } {
  if (!txns.length) return { from: null, to: null };
  const dates = txns.map((t) => t.date).sort();
  return { from: dates[0], to: dates[dates.length - 1] };
}

export function reconciliationSummary(txns: ParsedTxn[]) {
  const total = txns.length;
  const flagged = txns.filter((t) => t.needsReview).length;
  const high = txns.filter((t) => t.confidence === "high").length;
  const medium = txns.filter((t) => t.confidence === "medium").length;
  const low = txns.filter((t) => t.confidence === "low").length;
  return { total, flagged, high, medium, low };
}
