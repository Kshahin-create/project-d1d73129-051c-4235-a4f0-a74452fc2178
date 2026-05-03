import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Wrench, User as UserIcon, Lock, Users, Search, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type AppRole = "admin" | "control" | "manager" | "user";

interface UserRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  is_admin: boolean;
  role: AppRole;
}

const ROLE_META: Record<AppRole, { label: string; icon: typeof Shield; cls: string }> = {
  admin: { label: "أدمن", icon: Shield, cls: "bg-primary/10 text-primary" },
  manager: { label: "مدير", icon: Shield, cls: "bg-emerald-500/10 text-emerald-600" },
  control: { label: "Control (دعم/صيانة)", icon: Wrench, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  user: { label: "مستخدم", icon: UserIcon, cls: "bg-secondary text-muted-foreground" },
};

const AdminUsers = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [pendingChange, setPendingChange] = useState<{ row: UserRow; newRole: AppRole } | null>(null);
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
    setBusyId(pendingChange.row.user_id);
    const { error } = await supabase.rpc("admin_set_user_role", {
      _target_user: pendingChange.row.user_id,
      _new_role: pendingChange.newRole,
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

  const counts = {
    admin: rows.filter((r) => r.role === "admin").length,
    control: rows.filter((r) => r.role === "control").length,
    user: rows.filter((r) => r.role === "user").length,
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <main className="container-tight py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold sm:text-2xl">إدارة المستخدمين</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {rows.length} مستخدم — {counts.admin} أدمن · {counts.control} control · {counts.user} عادي
              </p>
            </div>
          </div>
          <Link
            to="/admin"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary sm:px-4 sm:text-sm"
          >
            <ArrowRight className="h-4 w-4" />
            <span className="hidden sm:inline">رجوع للوحة الأدمن</span>
            <span className="sm:hidden">رجوع</span>
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="border-b border-border bg-secondary/50 text-xs">
                  <tr>
                    <th className="p-3 text-right font-semibold">الاسم</th>
                    <th className="p-3 text-right font-semibold">البريد</th>
                    <th className="p-3 text-right font-semibold">تاريخ التسجيل</th>
                    <th className="p-3 text-right font-semibold">الدور الحالي</th>
                    <th className="p-3 text-right font-semibold">تغيير الدور</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const isSelf = r.user_id === user?.id;
                    const meta = ROLE_META[r.role] ?? ROLE_META.user;
                    const Icon = meta.icon;
                    return (
                      <tr key={r.user_id} className="border-b border-border last:border-0">
                        <td className="p-3 font-medium">{r.display_name || "—"}</td>
                        <td className="p-3 text-muted-foreground">{r.email || "—"}</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString("ar-EG-u-nu-latn")}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${meta.cls}`}>
                            <Icon className="h-3 w-3" /> {meta.label}
                          </span>
                        </td>
                        <td className="p-3">
                          {isSelf ? (
                            <span className="text-xs text-muted-foreground">(أنت)</span>
                          ) : (
                            <select
                              disabled={busyId === r.user_id}
                              value={r.role}
                              onChange={(e) => {
                                const newRole = e.target.value as AppRole;
                                if (newRole !== r.role) {
                                  setPendingChange({ row: r, newRole });
                                }
                              }}
                              className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium focus:border-primary focus:outline-none"
                            >
                              <option value="user">مستخدم</option>
                              <option value="control">Control (دعم/صيانة)</option>
                              <option value="manager">مدير</option>
                              <option value="admin">أدمن</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={!!pendingChange}
        title="تأكيد تغيير الدور"
        description={
          pendingChange
            ? `هل تريد تغيير دور «${pendingChange.row.display_name || pendingChange.row.email}» من "${ROLE_META[pendingChange.row.role].label}" إلى "${ROLE_META[pendingChange.newRole].label}"؟`
            : ""
        }
        confirmLabel="تأكيد التغيير"
        variant={pendingChange?.newRole === "admin" ? "primary" : pendingChange?.newRole === "user" && pendingChange?.row.role === "admin" ? "destructive" : "primary"}
        reasonRequired={true}
        reasonPlaceholder="اكتب سبب التغيير (مثال: تعيين مسؤول صيانة)"
        loading={!!busyId}
        onConfirm={handleConfirmChange}
        onCancel={() => setPendingChange(null)}
      />

      <Footer />
    </div>
  );
};

export default AdminUsers;
