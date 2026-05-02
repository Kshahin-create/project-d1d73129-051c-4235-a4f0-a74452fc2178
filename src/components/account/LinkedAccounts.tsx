import { useEffect, useState } from "react";
import { Link2, Mail, ShieldCheck, ChromeIcon, Apple } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Identity {
  id: string;
  provider: string;
  identity_data?: Record<string, any>;
  created_at?: string;
  last_sign_in_at?: string;
}

const providerMeta: Record<string, { label: string; Icon: any; color: string }> = {
  google: { label: "Google", Icon: ChromeIcon, color: "text-blue-600" },
  apple: { label: "Apple", Icon: Apple, color: "text-foreground" },
  email: { label: "البريد الإلكتروني", Icon: Mail, color: "text-primary" },
  phone: { label: "رقم الجوال", Icon: ShieldCheck, color: "text-emerald-600" },
};

export const LinkedAccounts = () => {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (!error && data?.identities) {
        setIdentities(data.identities as Identity[]);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
      <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Link2 className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg font-extrabold">طرق تسجيل الدخول المربوطة</h2>
          <p className="text-xs text-muted-foreground">
            الحسابات والوسائل المرتبطة بحسابك حالياً
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          جاري التحميل...
        </div>
      ) : identities.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          لا توجد طرق دخول مربوطة
        </p>
      ) : (
        <div className="space-y-2">
          {identities.map((id) => {
            const meta = providerMeta[id.provider] ?? {
              label: id.provider,
              Icon: ShieldCheck,
              color: "text-muted-foreground",
            };
            const Icon = meta.Icon;
            const email =
              id.identity_data?.email ?? id.identity_data?.preferred_username;
            return (
              <div
                key={id.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-secondary ${meta.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{meta.label}</div>
                  {email && (
                    <div dir="ltr" className="truncate text-right text-xs text-muted-foreground">
                      {email}
                    </div>
                  )}
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  مربوط
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
