import { useEffect, useState, useCallback } from "react";

/**
 * localStorage-backed custom types (income / investment / payment method etc.).
 * User-scoped by browser. Safe fallback when localStorage isn't available.
 */
export type CustomTypeKind = "income" | "investment" | "expense-payment";

function keyFor(kind: CustomTypeKind) {
  return `familykhata:customTypes:${kind}`;
}

function read(kind: CustomTypeKind): string[] {
  try {
    const raw = localStorage.getItem(keyFor(kind));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(kind: CustomTypeKind, v: string[]) {
  try {
    localStorage.setItem(keyFor(kind), JSON.stringify(v));
    window.dispatchEvent(new CustomEvent(`custom-types:${kind}`));
  } catch {
    /* ignore */
  }
}

export function useCustomTypes(kind: CustomTypeKind) {
  const [list, setList] = useState<string[]>(() => read(kind));

  useEffect(() => {
    const h = () => setList(read(kind));
    window.addEventListener(`custom-types:${kind}`, h);
    return () => window.removeEventListener(`custom-types:${kind}`, h);
  }, [kind]);

  const add = useCallback(
    (v: string) => {
      const t = v.trim();
      if (!t) return;
      const next = Array.from(new Set([...read(kind), t]));
      write(kind, next);
      setList(next);
    },
    [kind],
  );

  const remove = useCallback(
    (v: string) => {
      const next = read(kind).filter((x) => x !== v);
      write(kind, next);
      setList(next);
    },
    [kind],
  );

  return { list, add, remove };
}
