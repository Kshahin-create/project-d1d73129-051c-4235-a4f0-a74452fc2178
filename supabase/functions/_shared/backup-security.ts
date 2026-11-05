export function isTrustedBackupCron(configured: string | undefined, supplied: string | null): boolean {
  return Boolean(configured && supplied && configured === supplied);
}
export function allowsBackupAction(action: string, cron: boolean): boolean {
  return !['restore','delete'].includes(action) && (!cron || action === 'create');
}