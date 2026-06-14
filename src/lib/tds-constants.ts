export type TDSSection = {
  code: string;
  label: string;
  rate: number;
  description: string;
};

export const TDS_SECTIONS: TDSSection[] = [
  { code: "192", label: "192 — Salary", rate: 0, description: "Salary (slab rate)" },
  { code: "192A", label: "192A — PF withdrawal", rate: 10, description: "PF withdrawal" },
  { code: "193", label: "193 — Securities interest", rate: 10, description: "Interest on securities" },
  { code: "194", label: "194 — Dividend", rate: 10, description: "Dividend" },
  { code: "194A", label: "194A — FD/RD/Savings interest", rate: 10, description: "FD/RD/Savings interest" },
  { code: "194B", label: "194B — Lottery", rate: 30, description: "Lottery, crossword" },
  { code: "194C", label: "194C — Contractor", rate: 1, description: "Contractor payments" },
  { code: "194D", label: "194D — Insurance commission", rate: 5, description: "Insurance commission" },
  { code: "194DA", label: "194DA — Life insurance maturity", rate: 5, description: "Life insurance maturity" },
  { code: "194H", label: "194H — Commission / brokerage", rate: 5, description: "Commission or brokerage" },
  { code: "194I", label: "194I — Rent", rate: 10, description: "Rent" },
  { code: "194IA", label: "194IA — Property purchase >50L", rate: 1, description: "Property purchase >50L" },
  { code: "194IB", label: "194IB — Rent >50K/month", rate: 5, description: "Rent >50K/month" },
  { code: "194J", label: "194J — Professional / technical fees", rate: 10, description: "Professional / technical" },
  { code: "194K", label: "194K — Mutual fund income", rate: 10, description: "MF income" },
  { code: "194N", label: "194N — Cash withdrawal", rate: 2, description: "Cash withdrawal" },
  { code: "194O", label: "194O — E-commerce", rate: 1, description: "E-commerce" },
  { code: "194Q", label: "194Q — Goods purchase >50L", rate: 0.1, description: "Goods purchase >50L" },
  { code: "195", label: "195 — NRI payments", rate: 0, description: "NRI payments (varies)" },
  { code: "NOT_SURE", label: "Not Sure", rate: 0, description: "Not classified yet" },
];

export function getTDSSectionByCode(code: string | null | undefined): TDSSection | undefined {
  if (!code) return undefined;
  return TDS_SECTIONS.find((s) => s.code === code);
}

export function getTDSSection(incomeType: string): string {
  const t = (incomeType ?? "").toLowerCase();
  if (t === "salary") return "192";
  if (t.includes("fd") || t.includes("interest")) return "194A";
  if (t.includes("business")) return "194J";
  if (t.includes("dividend") && t.includes("mutual")) return "194K";
  if (t === "dividend") return "194";
  if (t.includes("mf") || t.includes("mutual fund")) return "194K";
  if (t.includes("rent")) return "194I";
  return "NOT_SURE";
}

export const TDS_QUICK_OPTIONS: { label: string; code: string }[] = [
  { label: "Salary → 192", code: "192" },
  { label: "Bank/FD interest → 194A", code: "194A" },
  { label: "Professional fees → 194J", code: "194J" },
  { label: "Contractor payment → 194C", code: "194C" },
  { label: "Rent received → 194I", code: "194I" },
  { label: "Dividend → 194", code: "194" },
];
