// Remember a password *pattern hint* per bank in localStorage so the user
// can recall it later (we don't store the password itself for security).
const KEY = "fl_pdf_pw_hints_v1";

type Hints = Record<string, string>; // bank -> hint string

function read(): Hints {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Hints) : {};
  } catch { return {}; }
}

export function getHint(bank: string): string | undefined {
  return read()[bank];
}

export function setHint(bank: string, hint: string): void {
  const all = read();
  all[bank] = hint;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ignore */ }
}
