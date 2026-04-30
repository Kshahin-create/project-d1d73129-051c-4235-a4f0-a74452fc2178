import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, ShieldOff, Lock, Users, Search, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface UserRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  is_admin: boolean;
}

const AdminUsers = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [pendingChange, setPendingChange] = useState<UserRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setFetching(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) {
      toast.error("تعذّر تحميل المستخدمين: " + error.message);
    } else {
      setRows((data as UserRow[]) ?? []);
    }
    setFetching(false);
  };

  useEffect(() => {
    if (!loading && isAdmin) load();
  }, [loading, isAdmin]);

  if (!loading && !user) {
    navigate("/auth");
    return null;
  }
  if (!loading && user && !isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container-tight py-16">
          <div className="mx-auto max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <Lock className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 font-display text-xl font-bold">لا تملك صلاحية الوصول</h2>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const handleConfirmChange = async () => {
    if (!pendingChange) return;
    setBusyId(pendingChange.user_id);
    const { error } = await supabase.rpc("admin_set_role", {
      _target_user: pendingChange.user_id,
      _make_admin: !pendingChange.is_admin,
    });
    setBusyId(null);
    setPendingChange(null);
    if (error) {
      toast.error("فشل التحديث: " + error.message);
    } else {
      toast.success("تم تحديث الصلاحية بنجاح");
      load();
    }
  };

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.email ?? "").toLowerCase().includes(q) ||
      (r.display_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <main className="container-tight py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">إدارة المستخدمين</h1>
              <p className="text-sm text-muted-foreground">
                {rows.length} مستخدم — {rows.filter((r) => r.is_admin).length} أدمن
              </p>
            </div>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            <ArrowRight className="h-4 w-4" />
            رجوع للوحة الأدمن
          </Link>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card p-2">
          <Search className="mr-2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو البريد..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {fetching ? (
            <div className="p-12 text-center text-muted-foreground">جارِ التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا توجد نتائج</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs">
                <tr>
                  <th className="p-3 text-right font-semibold">الاسم</th>
                  <th className="p-3 text-right font-semibold">البريد</th>
                  <th className="p-3 text-right font-semibold">تاريخ التسجيل</th>
                  <th className="p-3 text-right font-semibold">الدور</th>
                  <th className="p-3 text-right font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isSelf = r.user_id === user?.id;
                  return (
                    <tr key={r.user_id} className="border-b border-border last:border-0">
                      <td className="p-3 font-medium">{r.display_name || "—"}</td>
                      <td className="p-3 text-muted-foreground">{r.email || "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="p-3">
                        {r.is_admin ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                            <Shield className="h-3 w-3" /> أدمن
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-semibold text-muted-foreground">
                            مستخدم
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {isSelf ? (
                          <span className="text-xs text-muted-foreground">(أنت)</span>
                        ) : (
                          <button
                            disabled={busyId === r.user_id}
                            onClick={() => setPendingChange(r)}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                              r.is_admin
                                ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                : "bg-primary text-primary-foreground hover:opacity-90"
                            }`}
                          >
                            {r.is_admin ? (
                              <>
                                <ShieldOff className="h-3 w-3" /> إزالة الأدمن
                              </>
                            ) : (
                              <>
                                <Shield className="h-3 w-3" /> ترقية لأدمن
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={!!pendingChange}
        title={pendingChange?.is_admin ? "إزالة صلاحية الأدمن" : "ترقية إلى أدمن"}
        description={
          pendingChange?.is_admin
            ? `هل تريد إزالة صلاحية الأدمن من «${pendingChange?.display_name || pendingChange?.email}»؟`
            : `هل تريد منح صلاحية الأدمن لـ «${pendingChange?.display_name || pendingChange?.email}»؟ سيتمكن من إدارة كل شيء.`
        }
        confirmLabel="تأكيد"
        variant={pendingChange?.is_admin ? "destructive" : "primary"}
        reasonRequired={true}
        reasonPlaceholder="اكتب سبب التغيير (مثال: ترقية مدير جديد)"
        loading={!!busyId}
        onConfirm={handleConfirmChange}
        onCancel={() => setPendingChange(null)}
      />

      <Footer />
    </div>
  );
};

export default AdminUsers;
