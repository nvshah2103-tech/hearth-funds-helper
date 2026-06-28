// Stable transaction fingerprint = SHA256(user|account|date|signed_amount|normDesc[:40])
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
): Promise<string> {
  const signed = (credit - debit).toFixed(2);
  const norm = normalizeDesc(description);
  const raw = `${userId}|${accountId}|${date}|${signed}|${norm}`;
  const buf = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
