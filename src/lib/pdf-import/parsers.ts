// Generic line-oriented Indian bank statement parser.
// Strategy: detect lines that start with a date and contain amount tokens.
// Works on HDFC / SBI / ICICI / Axis / Kotak text-extracted PDFs.
import type { ExtractedLine } from "./extract";

export type ParsedTxn = {
  date: string;          // YYYY-MM-DD
  description: string;
  debit: number;         // 0 if credit
  credit: number;        // 0 if debit
  balance: number | null;
  reference: string | null;
};

export type BankKey = "HDFC" | "SBI" | "ICICI" | "AXIS" | "KOTAK" | "GENERIC";

const DATE_RE_LIST = [
  // 01/02/2024, 01-02-2024
  /^(\d{2})[/\-](\d{2})[/\-](\d{2,4})\b/,
  // 01 Feb 2024, 01 Feb 24
  /^(\d{1,2})[ -]([A-Za-z]{3})[ -](\d{2,4})\b/,
  // 2024-02-01
  /^(\d{4})-(\d{2})-(\d{2})\b/,
];

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function normYear(y: string): string {
  if (y.length === 2) {
    const n = Number(y);
    return (n >= 70 ? "19" : "20") + y;
  }
  return y;
}

export function parseDateToken(token: string): string | null {
  let m = token.match(DATE_RE_LIST[0]);
  if (m) return `${normYear(m[3])}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = token.match(DATE_RE_LIST[1]);
  if (m) {
    const mm = MONTHS[m[2].toLowerCase()];
    if (mm) return `${normYear(m[3])}-${mm}-${m[1].padStart(2, "0")}`;
  }
  m = token.match(DATE_RE_LIST[2]);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

// Match Indian-style amounts: 1,23,456.78 / 1234.56 / 1,234
const AMOUNT_RE = /(\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d{1,2})?(?:\s?(Cr|Dr))?/gi;

export function detectBank(lines: ExtractedLine[]): BankKey {
  const head = lines.slice(0, 40).map((l) => l.text.toLowerCase()).join(" ");
  if (head.includes("hdfc bank")) return "HDFC";
  if (head.includes("state bank") || head.includes("sbi")) return "SBI";
  if (head.includes("icici")) return "ICICI";
  if (head.includes("axis bank")) return "AXIS";
  if (head.includes("kotak")) return "KOTAK";
  return "GENERIC";
}

function num(s: string): number {
  return Number(s.replace(/,/g, "")) || 0;
}

/**
 * Generic parser: any line starting with a recognizable date and containing
 * >= 2 numeric tokens is a transaction. Last numeric = balance; second-last
 * = amount. If "Cr"/"Dr" suffix present, use it; otherwise infer from a
 * "withdraw/credit" header column heuristic.
 */
export function parseStatement(lines: ExtractedLine[]): ParsedTxn[] {
  const out: ParsedTxn[] = [];
  // Continuation: if a line has no date but follows a txn line, append to desc.
  let last: ParsedTxn | null = null;

  for (const l of lines) {
    const txt = l.text.trim();
    if (!txt) continue;
    const firstTok = txt.split(/\s+/, 1)[0];
    const date = parseDateToken(firstTok) ?? parseDateToken(txt.slice(0, 12));
    if (!date) {
      // continuation
      if (last && txt.length < 80 && !/^[\d.,]+$/.test(txt)) {
        last.description = (last.description + " " + txt).trim().slice(0, 200);
      }
      continue;
    }

    // Find all amount-like tokens
    const matches = Array.from(txt.matchAll(AMOUNT_RE));
    if (matches.length < 2) continue;

    // Heuristic: balance = last amount, txn = second-last
    const balTok = matches[matches.length - 1];
    const amtTok = matches[matches.length - 2];
    const balance = num(balTok[1] + (balTok[0].includes(".") ? balTok[0].slice(balTok[0].indexOf(".")).match(/^\.\d+/)?.[0] ?? "" : ""));
    const balFull = num(balTok[0].replace(/\s?(Cr|Dr)/i, ""));
    const amtFull = num(amtTok[0].replace(/\s?(Cr|Dr)/i, ""));

    let credit = 0, debit = 0;
    const suffix = (amtTok[2] || "").toLowerCase();
    if (suffix === "cr") credit = amtFull;
    else if (suffix === "dr") debit = amtFull;
    else {
      // Three-amount layout (debit, credit, balance): middle is whichever is non-zero
      if (matches.length >= 3) {
        const a = num(matches[matches.length - 3][0].replace(/\s?(Cr|Dr)/i, ""));
        const b = amtFull;
        if (a > 0 && b === 0) debit = a;
        else if (b > 0 && a === 0) credit = b;
        else debit = a || b;
      } else {
        debit = amtFull;
      }
    }

    // Description = text between date and first amount token
    const firstAmtIdx = matches[0].index ?? 0;
    const dateLen = txt.match(/^\S+(\s+\S+){0,2}/)?.[0].length ?? firstTok.length;
    let desc = txt.slice(dateLen, firstAmtIdx).trim();
    desc = desc.replace(/\s+/g, " ").slice(0, 200);

    // Reference: any long digit run within description
    const refMatch = desc.match(/\b(\d{8,})\b/);
    const reference = refMatch ? refMatch[1] : null;

    const tx: ParsedTxn = {
      date, description: desc || "(no description)",
      debit, credit, balance: isFinite(balFull) ? balFull : (isFinite(balance) ? balance : null),
      reference,
    };
    out.push(tx);
    last = tx;
  }
  return out;
}

export function summarizeCoverage(txns: ParsedTxn[]): { from: string | null; to: string | null } {
  if (!txns.length) return { from: null, to: null };
  const dates = txns.map((t) => t.date).sort();
  return { from: dates[0], to: dates[dates.length - 1] };
}
