// Client mirrors of database safety rules (the database enforces them; these only guide the UI).

export const MIN_REASON_LENGTH = 5;

export function isValidReason(reason: string | null | undefined): boolean {
  return (reason ?? "").trim().length >= MIN_REASON_LENGTH;
}

/** A reversal entry is the exact negative of the original amount. */
export function reversalAmount(original: number): number {
  return -Math.abs(original);
}

export type UnitStatus = "available" | "rented" | "reserved" | "maintenance";

/** Control role: may only put a unit into maintenance, or return it to the status it had before. */
export function controlCanSetStatus(
  current: UnitStatus,
  next: UnitStatus,
  statusBeforeMaintenance: UnitStatus | null,
): boolean {
  if (current === next) return false;
  if (next === "maintenance") return true;
  return current === "maintenance" && statusBeforeMaintenance !== null && next === statusBeforeMaintenance;
}
