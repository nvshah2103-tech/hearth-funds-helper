// Client-only PDF text extraction with optional password support.
// Returns per-line tokens with X-coordinates so the parser can do
// column-detection (needed to correctly bin debit vs credit vs balance).
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pdfjs as any).GlobalWorkerOptions.workerSrc = workerSrc;

export type LineToken = { x: number; width: number; s: string };
export type ExtractedLine = {
  page: number;
  y: number;
  text: string;
  tokens: LineToken[];
  pageWidth: number;
};

export class PasswordRequiredError extends Error {
  constructor(public incorrect: boolean) {
    super(incorrect ? "Incorrect password" : "Password required");
  }
}

/** Merge visually-adjacent items on the same Y into cluster tokens.
 *  Fixes cases where "1,23,456.78" was split into ["1", ",23", ",456.78"]. */
function mergeAdjacent(items: { x: number; s: string; w: number }[]): LineToken[] {
  if (!items.length) return [];
  items.sort((a, b) => a.x - b.x);
  const out: LineToken[] = [];
  const GAP = 2; // px – anything closer is one visual token
  for (const it of items) {
    const last = out[out.length - 1];
    const gap = last ? it.x - (last.x + last.width) : Infinity;
    if (last && gap <= GAP) {
      last.s += it.s;
      last.width = it.x + it.w - last.x;
    } else {
      out.push({ x: it.x, width: it.w, s: it.s });
    }
  }
  return out;
}

/** Extract logical lines from a PDF. Rows on same Y (±2 px) become one line. */
export async function extractPdfLines(
  file: File,
  password?: string,
): Promise<ExtractedLine[]> {
  const buf = await file.arrayBuffer();
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: buf, password: password ?? undefined }).promise;
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = e as any;
    if (err?.name === "PasswordException") {
      throw new PasswordRequiredError(err.code === 2);
    }
    throw e;
  }
  const lines: ExtractedLine[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const buckets = new Map<number, { y: number; items: { x: number; s: string; w: number }[] }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const it of content.items as any[]) {
      const s = String(it.str ?? "");
      if (!s.trim()) continue;
      const tr = it.transform as number[];
      const y = Math.round(tr[5] / 2) * 2;
      const x = tr[4];
      const w = Number(it.width ?? Math.max(2, s.length * 4));
      const b = buckets.get(y) ?? { y, items: [] };
      b.items.push({ x, s, w });
      buckets.set(y, b);
    }
    for (const b of buckets.values()) {
      const tokens = mergeAdjacent(b.items);
      const text = tokens.map((t) => t.s).join(" ").replace(/\s+/g, " ").trim();
      if (text) lines.push({ page: p, y: b.y, text, tokens, pageWidth: viewport.width });
    }
  }
  lines.sort((a, b) => a.page - b.page || b.y - a.y);
  return lines;
}
