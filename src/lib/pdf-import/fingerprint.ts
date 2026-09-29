// Stable v2 fingerprint also includes printed balance and same-row occurrence.
export function normalizeDesc(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 40);
}

export async function makeFingerprint(
  userId: string,
  accountId: string,
  date: string,
  debit: number,
  credit: number,
  description: string,
  balance?: number | null,
  occurrence = 0,
): Promise<string> {
  const signed = (credit - debit).toFixed(2);
  const norm = normalizeDesc(description);
  const bal = balance == null ? "" : Number(balance).toFixed(2);
  const raw = `${userId}|${accountId}|${date}|${signed}|${norm}|${bal}|${occurrence}`;
  const buf = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Legacy hash retained so re-importing an old statement still deduplicates. */
export async function makeLegacyFingerprint(
  userId: string,
  accountId: string,
  date: string,
  debit: number,
  credit: number,
  description: string,
): Promise<string> {
  const raw = `${userId}|${accountId}|${date}|${(credit - debit).toFixed(2)}|${normalizeDesc(description)}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
