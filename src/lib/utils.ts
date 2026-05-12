import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * تنسيق الأرقام (مساحات وغيرها) بحد أقصى منزلتين عشريتين
 * مع إزالة الأصفار الزائدة. مثال: 308.65999999999997 → "308.66"
 */
export function fmtNum(n: number | string | null | undefined, maxFractionDigits = 2): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("en-US", { maximumFractionDigits: maxFractionDigits });
}
