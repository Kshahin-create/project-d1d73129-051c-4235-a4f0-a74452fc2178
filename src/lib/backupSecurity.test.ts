import { describe,expect,it } from 'vitest';
import { isTrustedBackupCron,allowsBackupAction } from '../../supabase/functions/_shared/backup-security';
describe('backup safety',()=>{
 it('missing secret never authorizes cron',()=>expect(isTrustedBackupCron(undefined,'anything')).toBe(false));
 it('empty headers never authorize cron',()=>expect(isTrustedBackupCron('',null)).toBe(false));
 it('only configured secret authorizes cron',()=>{expect(isTrustedBackupCron('configured','wrong')).toBe(false);expect(isTrustedBackupCron('configured','configured')).toBe(true);});
 it('cron cannot download backups',()=>expect(allowsBackupAction('download',true)).toBe(false));
 it('cron retains scheduled creation',()=>expect(allowsBackupAction('create',true)).toBe(true));
 it('restore never deletes business records',()=>expect(allowsBackupAction('restore',false)).toBe(false));
 it('backup history is not hard deleted',()=>expect(allowsBackupAction('delete',false)).toBe(false));
});