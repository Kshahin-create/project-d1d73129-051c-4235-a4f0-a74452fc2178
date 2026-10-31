import { parsePhoneNumberFromString } from 'npm:libphonenumber-js@1.12.42';

export const SOURCES = [
  ['customer_profiles', 'phone', 'ملفات العملاء'], ['bookings', 'customer_phone', 'الحجوزات'],
  ['tenant_accounts', 'phone', 'حسابات المستأجرين'], ['tenants', 'phone', 'المستأجرون'],
  ['interested_customers', 'phone', 'المهتمون'], ['leads', 'phone', 'المستهدفون'],
  ['invoices', 'customer_phone', 'الفواتير'],
] as const;
export function normalizePhone(raw: string): string | null {
  let value = raw.trim().replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  if (value.startsWith('00')) value = '+' + value.slice(2);
  if (/^966\d+$/.test(value)) value = '+' + value;
  const phone = parsePhoneNumberFromString(value, 'SA');
  return phone?.isValid() ? phone.number : null;
}
export function audience(rows: { phone: string; source: string }[]) {
  const map = new Map<string, Set<string>>(); let invalid = 0; let duplicates = 0;
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!row.phone.trim()) continue;
    counts[row.source] = (counts[row.source] || 0) + 1;
    const phone = normalizePhone(row.phone);
    if (!phone) { invalid++; continue; }
    if (map.has(phone)) duplicates++;
    const sources = map.get(phone) || new Set<string>(); sources.add(row.source); map.set(phone, sources);
  }
  return { recipients: [...map].map(([phone, sources]) => ({ phone, sources: [...sources] })), summary: { total: map.size, invalid, duplicates, sources: counts } };
}
export function templateComponents(body: string[], header: string, image: string) {
  const components: object[] = [];
  if (image) components.push({ type: 'header', parameters: [{ type: 'image', image: { link: image } }] });
  else if (header) components.push({ type: 'header', parameters: [{ type: 'text', text: header }] });
  if (body.length) components.push({ type: 'body', parameters: body.map(text => ({ type: 'text', text })) });
  return components;
}
export function outcome(status: number): 'accepted' | 'unknown' | 'failed' {
  return status >= 200 && status < 300 ? 'accepted' : status >= 500 || status === 408 ? 'unknown' : 'failed';
}