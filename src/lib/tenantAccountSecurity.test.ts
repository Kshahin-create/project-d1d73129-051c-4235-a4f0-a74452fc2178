import { describe,it,expect } from 'vitest';
import { allowsTenantCredentialAction } from '../../supabase/functions/_shared/tenant-account-security';
describe('tenant credential boundaries',()=>{
 it('staff cannot set tenant passwords',()=>expect(allowsTenantCredentialAction('set_password','secret')).toBe(false));
 it('staff cannot create a tenant with a chosen password',()=>expect(allowsTenantCredentialAction('create','secret')).toBe(false));
 it('staff cannot generate legacy password-changing login links',()=>expect(allowsTenantCredentialAction('magic_link',undefined)).toBe(false));
 it('keeps password-free tenant record creation',()=>expect(allowsTenantCredentialAction('create',undefined)).toBe(true));
 it('keeps archive actions',()=>expect(allowsTenantCredentialAction('delete',undefined)).toBe(true));
});