export function hasAdministrativeWriteAccess(roles: readonly string[]): boolean {
  return roles.includes("admin");
}