export type IdType = "commercial_registration" | "national_id" | "iqama";

export const ID_TYPES: { value: IdType; label: string; numberLabel: string; prefix: string }[] = [
  { value: "commercial_registration", label: "سجل تجاري", numberLabel: "الرقم الموحد للسجل التجاري", prefix: "7" },
  { value: "national_id", label: "هوية وطنية", numberLabel: "رقم الهوية الوطنية", prefix: "1" },
  { value: "iqama", label: "إقامة", numberLabel: "رقم الإقامة", prefix: "2" },
];

/** Mirrors public.validate_identity in the database: 10 digits with a type-specific first digit. */
export function isValidIdentity(idType: IdType | string | null | undefined, number: string | null | undefined): boolean {
  const t = ID_TYPES.find((x) => x.value === idType);
  if (!t) return false;
  return new RegExp(`^${t.prefix}\\d{9}$`).test((number ?? "").trim());
}

export function identityError(idType: IdType): string {
  const t = ID_TYPES.find((x) => x.value === idType)!;
  return `${t.numberLabel} يجب أن يكون 10 أرقام ويبدأ بـ ${t.prefix}`;
}
