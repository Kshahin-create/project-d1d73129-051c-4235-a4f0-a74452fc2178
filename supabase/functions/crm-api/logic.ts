// Pure helpers for the read-only CRM API (no Deno/Supabase imports so they are unit-testable).
export type CrmScope = "crm:read" | "crm:pii" | "crm:finance";
export const CRM_SCOPES: CrmScope[] = ["crm:read", "crm:pii", "crm:finance"];

export interface Cursor { t: string; id: string }

export function encodeCursor(c: Cursor): string {
  return btoa(JSON.stringify(c)).replace(/=+$/, "");
}
export function decodeCursor(s: string | null): Cursor | null {
  if (!s) return null;
  try {
    const pad = s + "=".repeat((4 - (s.length % 4)) % 4);
    const v = JSON.parse(atob(pad));
    if (typeof v?.t !== "string" || typeof v?.id !== "string") return null;
    if (isNaN(Date.parse(v.t)) || !/^[0-9a-f-]{36}$/i.test(v.id)) return null;
    return v;
  } catch {
    return null;
  }
}

export function parseLimit(v: string | null): number {
  const n = Number(v ?? 100);
  if (!Number.isFinite(n) || n < 1) return 100;
  return Math.min(500, Math.floor(n));
}

/** Null out fields the caller's scopes do not allow. */
export function redact<T extends Record<string, unknown>>(
  row: T,
  scopes: string[],
  pii: string[],
  finance: string[],
): T {
  const out: Record<string, unknown> = { ...row };
  if (!scopes.includes("crm:pii")) for (const f of pii) if (f in out) out[f] = null;
  if (!scopes.includes("crm:finance")) for (const f of finance) if (f in out) out[f] = null;
  return out as T;
}

export function hasCrmAccess(scopes: string[]): boolean {
  return scopes.includes("crm:read");
}
