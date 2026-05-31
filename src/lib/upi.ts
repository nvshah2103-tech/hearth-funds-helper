/** Parse a UPI ID or use the explicit Paid-To name to produce a friendly display. */
export function parseUPIDisplay(
  upiId: string | null | undefined,
  paidToName?: string | null,
): { name: string; isUpi: boolean } {
  if (paidToName && paidToName.trim()) {
    return { name: paidToName.trim(), isUpi: Boolean(upiId) };
  }
  if (!upiId) return { name: "", isUpi: false };

  const namePart = upiId.split("@")[0] ?? upiId;
  // If it's mostly digits (phone-number based), keep it as-is
  const digits = namePart.replace(/\D/g, "");
  if (digits.length >= 8 && digits.length / namePart.length > 0.7) {
    return { name: namePart, isUpi: true };
  }
  const cleaned = namePart
    .replace(/[._\-]+/g, " ")
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const titled = cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return { name: titled || namePart, isUpi: true };
}
