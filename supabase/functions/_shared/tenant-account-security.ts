export function allowsTenantCredentialAction(action: string, password: unknown): boolean {
  return action !== 'set_password' && action !== 'magic_link' && !(action === 'create' && password !== undefined && password !== null && password !== '');
}