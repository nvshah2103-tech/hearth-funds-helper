// Client-only PDF text extraction with optional password support.
// Uses pdfjs-dist's legacy build for broad browser compat.
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pdfjs as any).GlobalWorkerOptions.workerSrc = workerSrc;

export type ExtractedLine = {
  page: number;
  y: number;
  text: string;
};

export class PasswordRequiredError extends Error {
  constructor(public incorrect: boolean) {
    super(incorrect ? "Incorrect password" : "Password required");
  }
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
      throw new PasswordRequiredError(err.code === 2 /* INCORRECT_PASSWORD */);
    }
    throw e;
  }
  const lines: ExtractedLine[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Group items by y rounded to 2px
    const buckets = new Map<number, { y: number; items: { x: number; s: string }[] }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const it of content.items as any[]) {
      const s = String(it.str ?? "");
      if (!s.trim()) continue;
      const tr = it.transform as number[];
      const y = Math.round(tr[5] / 2) * 2;
      const x = tr[4];
      const b = buckets.get(y) ?? { y, items: [] };
      b.items.push({ x, s });
      buckets.set(y, b);
    }
    for (const b of buckets.values()) {
      b.items.sort((a, z) => a.x - z.x);
      const text = b.items.map((i) => i.s).join(" ").replace(/\s+/g, " ").trim();
      if (text) lines.push({ page: p, y: b.y, text });
    }
  }
  // Sort by page then descending y (top of page first)
  lines.sort((a, b) => a.page - b.page || b.y - a.y);
  return lines;
}
