import { WHATSAPP_NUMBER } from "./config";
import type { Unit } from "@/data/types";

export interface CustomerData {
  fullName: string;
  phone: string;
  email?: string;
  business: string;
  notes?: string;
}

/**
 * يبني نص رسالة واتساب الخام (بدون ترميز URL)
 * Builds the raw WhatsApp message text (un-encoded).
 */
export function buildWhatsAppMessage(unit: Unit, customer: CustomerData): string {
  const date = new Date().toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const lines = [
    "🏢 *طلب حجز جديد - المدينة الصناعية بشمال مكة*",
    "",
    `📍 *المبنى:* رقم ${unit.buildingNumber} - ${unit.buildingType}`,
    `🔢 *رقم الوحدة:* ${unit.unitNumber}${unit.unitType ? ` (${unit.unitType})` : ""}`,
    `📐 *المساحة:* ${unit.area} م²`,
    `💰 *السعر السنوي:* ${unit.price.toLocaleString("en-US")} ريال`,
    "",
    "👤 *بيانات العميل:*",
    `• الاسم: ${customer.fullName}`,
    `• الجوال: ${customer.phone}`,
    customer.email ? `• البريد: ${customer.email}` : null,
    `• النشاط: ${customer.business}`,
    customer.notes ? `• ملاحظات: ${customer.notes}` : null,
    "",
    `📅 *تاريخ الطلب:* ${date}`,
    "",
    "_تم الإرسال عبر استمارة الحجز الإلكترونية - نخبة تسكين العقارية_",
  ].filter(Boolean) as string[];

  return lines.join("\n");
}

/**
 * يولّد روابط واتساب (تطبيق + ويب) ونص الرسالة
 * Generates WhatsApp links (app + web) and the raw text.
 */
export function buildWhatsAppLinks(unit: Unit, customer: CustomerData) {
  const text = buildWhatsAppMessage(unit, customer);
  const encoded = encodeURIComponent(text);
  return {
    text,
    // الرابط العالمي - يفتح التطبيق إن وُجد، وإلا واتساب ويب
    appUrl: `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`,
    // رابط واتساب ويب كبديل صريح
    webUrl: `https://web.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encoded}`,
    // رابط api.whatsapp.com كبديل ثانٍ يعمل على معظم الأجهزة
    apiUrl: `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encoded}`,
  };
}

/**
 * متوافق مع الإصدار السابق - يُرجع رابط wa.me فقط
 * Backwards-compatible: returns the wa.me link only.
 */
export function buildWhatsAppLink(unit: Unit, customer: CustomerData): string {
  return buildWhatsAppLinks(unit, customer).appUrl;
}

/**
 * نسخ نص إلى الحافظة مع آلية بديلة للمتصفحات القديمة/غير الآمنة
 * Copy text to clipboard with a legacy fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallthrough to legacy
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
