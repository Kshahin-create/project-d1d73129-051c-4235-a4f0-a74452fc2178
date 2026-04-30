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
 * يبني نص رسالة واتساب الخام (بدون ترميز URL) - يدعم وحدة واحدة أو عدة وحدات
 * Builds the raw WhatsApp message text (un-encoded). Supports one or many units.
 */
export function buildWhatsAppMessage(unitOrUnits: Unit | Unit[], customer: CustomerData): string {
  const units = Array.isArray(unitOrUnits) ? unitOrUnits : [unitOrUnits];
  const date = new Date().toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalArea = units.reduce((s, u) => s + u.area, 0);
  const totalPrice = units.reduce((s, u) => s + u.price, 0);

  const header = [
    "🏢 *طلب حجز جديد - المدينة الصناعية بشمال مكة*",
    "",
    `📦 *عدد الوحدات المطلوبة:* ${units.length}`,
    "",
  ];

  const unitsBlock: string[] = [];
  units.forEach((unit, idx) => {
    if (units.length > 1) unitsBlock.push(`— *وحدة ${idx + 1}* —`);
    unitsBlock.push(
      `📍 *المبنى:* رقم ${unit.buildingNumber} - ${unit.buildingType}`,
      `🔢 *رقم الوحدة:* ${unit.unitNumber}${unit.unitType ? ` (${unit.unitType})` : ""}`,
      `📐 *المساحة:* ${unit.area} م²`,
      `💰 *السعر السنوي:* ${unit.price.toLocaleString("en-US")} ريال`,
      ""
    );
  });

  if (units.length > 1) {
    unitsBlock.push(
      "— *الإجمالي* —",
      `📐 *إجمالي المساحات:* ${totalArea.toLocaleString("en-US")} م²`,
      `💰 *إجمالي الإيجار السنوي:* ${totalPrice.toLocaleString("en-US")} ريال`,
      ""
    );
  }

  const customerBlock = [
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

  return [...header, ...unitsBlock, ...customerBlock].join("\n");
}

/**
 * يولّد روابط واتساب (تطبيق + ويب) ونص الرسالة
 */
export function buildWhatsAppLinks(unitOrUnits: Unit | Unit[], customer: CustomerData) {
  const text = buildWhatsAppMessage(unitOrUnits, customer);
  const encoded = encodeURIComponent(text);
  return {
    text,
    appUrl: `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`,
    webUrl: `https://web.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encoded}`,
    apiUrl: `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encoded}`,
  };
}

/**
 * متوافق مع الإصدار السابق
 */
export function buildWhatsAppLink(unit: Unit | Unit[], customer: CustomerData): string {
  return buildWhatsAppLinks(unit, customer).appUrl;
}

/**
 * نسخ نص إلى الحافظة
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
