export type RecordKind = "units" | "parties" | "contracts" | "receipts" | "bookings" | "opportunities";
export const recordHref = (kind: RecordKind, id: string) => `/admin/${kind}/${encodeURIComponent(id)}`;
export const legacyAdminRoutes: Record<string, string> = {
  "/admin/api-keys": "/admin/settings/developers/api-keys",
  "/admin/stats": "/admin/settings/developers/stats",
  "/api-docs": "/admin/settings/developers/api-docs",
  "/mcp": "/admin/settings/developers/mcp",
  "/crm": "/admin/opportunities",
  "/crm/unassigned": "/admin/opportunities/unassigned",
  "/crm/team": "/admin/opportunities/team",
  "/crm/import": "/admin/opportunities/import",
};
export function redirectedAdminHref(path: string, search = "", hash = "") {
  const dynamic = path.match(/^\/crm\/(party|opportunity)\/([^/]+)$/);
  const destination = dynamic ? `/admin/${dynamic[1] === "party" ? "parties" : "opportunities"}/${dynamic[2]}` : legacyAdminRoutes[path];
  return destination ? `${destination}${search}${hash}` : null;
}
export function activeAdminGroup(path: string) {
  if (path.startsWith("/admin/settings") || /\/admin\/(users|audit|access-log|backup|sheets-sync|booking-control)/.test(path)) return "settings";
  if (/\/admin\/(units|unit-status)/.test(path)) return "units";
  if (/\/admin\/(contracts|tenant)/.test(path)) return "tenants";
  if (/\/admin\/(receipts|receipt-|installments|paid-tenants|collections-report)/.test(path)) return "finance";
  if (/\/admin\/(parties|opportunities|bookings|leads|interested|campaigns)/.test(path) || path.startsWith("/leasing")) return "customers";
  return "home";
}