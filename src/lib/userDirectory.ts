export interface DirectoryDetails {
  full_name?: string | null;
  display_name: string | null;
  email: string | null;
  contact_email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  business_name?: string | null;
  activity_type?: string | null;
  notes?: string | null;
  profile_updated_at?: string | null;
  last_sign_in_at?: string | null;
  ip_address?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  isp?: string | null;
  user_agent?: string | null;
  access_recorded_at?: string | null;
  access_event?: string | null;
}

export const directoryName = (row: DirectoryDetails) => row.full_name?.trim() || row.display_name?.trim() || "اسم غير مسجّل";

export function matchesDirectorySearch(row: DirectoryDetails, query: string) {
  const q = query.trim().toLocaleLowerCase();
  return [row.full_name, row.display_name, row.email, row.contact_email, row.phone, row.business_name, row.activity_type, row.ip_address, row.country, row.city]
    .some(value => value?.toLocaleLowerCase().includes(q));
}