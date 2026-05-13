import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Wrench, User as UserIcon, Lock, Users, Search, ArrowRight, UserPlus, Sparkles, ShieldCheck, Briefcase } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { fmtNum } from "@/lib/utils";

type AppRole = "admin" | "control" | "manager" | "user";

interface UserRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  is_admin: boolean;
  role: AppRole;
}

const ROLE_META: Record<AppRole, { label: string; icon: typeof Shield; cls: string; ring: string }> = {
  admin: { label: "أدمن", icon: Shield, cls: "bg-primary/10 text-primary", ring: "ring-primary/20" },
  manager: { label: "مدير", icon: Briefcase, cls: "bg-emerald-500/10 text-emerald-600", ring: "ring-emerald-500/20" },
  control: { label: "Control", icon: Wrench, cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", ring: "ring-amber-500/20" },
  user: { label: "مستخدم", icon: UserIcon, cls: "bg-secondary text-muted-foreground", ring: "ring-border" },
};

const TONE_CLS: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600",
  amber: "bg-amber-500/10 text-amber-600",
  sky: "bg-sky-500/10 text-sky-600",
  violet: "bg-violet-500/10 text-violet-600",
  rose: "bg-rose-500/10 text-rose-600",
};

function StatCard({
  title, value, hint, Icon, tone = "primary",
}: {
  title: string; value: string; hint?: string; Icon: typeof Shield;
  tone?: "primary" | "emerald" | "amber" | "sky" | "violet" | "rose";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-muted-foreground sm:text-xs">{title}</div>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${TONE_CLS[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-1.5 font-display text-lg font-bold leading-tight sm:text-xl">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">{hint}</div>}
    </div>
  );
}

const initials = (name: string | null, email: string | null) => {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
};

const AdminUsers = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");
  const [pendingChange, setPendingChange] = useState<{ row: UserRow; newRole: AppRole } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setFetching(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) toast.error("تعذّر تحميل المستخدمين: " + error.message);
    else setRows((data as UserRow[]) ?? []);
    setFetching(false);
  };

  useEffect(() => {
    if (!loading && isAdmin) load();
  }, [loading, isAdmin]);

  const stats = useMemo(() => {
    const now = Date.now();
    const day = 24 * 3600 * 1000;
    const newToday = rows.filter((r) => now - new Date(r.created_at).getTime() <= day).length;
    const new7 = rows.filter((r) => now - new Date(r.created_at).getTime() <= 7 * day).length;
    const new30 = rows.filter((r) => now - new Date(r.created_at).getTime() <= 30 * day).length;
    const counts = {
      admin: rows.filter((r) => r.role === "admin").length,
      manager: rows.filter((r) => r.role === "manager").length,
      control: rows.filter((r) => r.role === "control").length,
      user: rows.filter((r) => r.role === "user").length,
    };
    const staff = counts.admin + counts.manager + counts.control;
    const staffRate = rows.length ? Math.round((staff / rows.length) * 100) : 0;
    return { total: rows.length, ...counts, staff, staffRate, newToday, new7, new30 };
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (roleFilter !== "all") list = list.filter((r) => r.role === roleFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) => (r.email ?? "").toLowerCase().includes(q) || (r.display_name ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, search, roleFilter]);

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
    if (error) toast.error("فشل التحديث: " + error.message);
    else {
      toast.success("تم تحديث الصلاحية بنجاح");
      load();
    }
  };

  const filterChips: { id: "all" | AppRole; label: string }[] = [
    { id: "all", label: "الكل" },
    { id: "admin", label: "أدمن" },
    { id: "manager", label: "مدير" },
    { id: "control", label: "Control" },
    { id: "user", label: "مستخدم" },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <main className="container-tight py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-card">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold sm:text-2xl">إدارة المستخدمين</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">{rows.length} مستخدم مسجّل</p>
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

        {/* Stats */}
        {!fetching && rows.length > 0 && (
          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard title="إجمالي المستخدمين" value={fmtNum(stats.total)} hint={`${stats.staff} ضمن الفريق (${stats.staffRate}%)`} Icon={Users} tone="primary" />
            <StatCard title="جدد اليوم" value={fmtNum(stats.newToday)} hint={`${stats.new7} خلال 7 أيام`} Icon={UserPlus} tone="emerald" />
            <StatCard title="جدد آخر 30 يوم" value={fmtNum(stats.new30)} hint="معدل النمو الشهري" Icon={Sparkles} tone="violet" />
            <StatCard title="أدمن" value={fmtNum(stats.admin)} hint="صلاحيات كاملة" Icon={Shield} tone="primary" />
            <StatCard title="مديرون" value={fmtNum(stats.manager)} hint="عرض ومتابعة" Icon={Briefcase} tone="emerald" />
            <StatCard title="Control" value={fmtNum(stats.control)} hint="دعم / صيانة" Icon={Wrench} tone="amber" />
            <StatCard title="مستخدمون عاديون" value={fmtNum(stats.user)} hint="بدون صلاحيات إدارية" Icon={UserIcon} tone="sky" />
            <StatCard title="إجمالي الفريق" value={fmtNum(stats.staff)} hint={`${stats.staffRate}% من المسجّلين`} Icon={ShieldCheck} tone="violet" />
          </div>
        )}

        {/* Search + filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-xl border border-border bg-card p-2">
            <Search className="mr-2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو البريد..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
            {filterChips.map((c) => (
              <button
                key={c.id}
                onClick={() => setRoleFilter(c.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  roleFilter === c.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {fetching ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">جارِ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">لا توجد نتائج</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((r) => {
              const isSelf = r.user_id === user?.id;
              const meta = ROLE_META[r.role] ?? ROLE_META.user;
              const Icon = meta.icon;
              return (
                <div
                  key={r.user_id}
                  className={`rounded-2xl border border-border bg-card p-4 shadow-card ring-1 ${meta.ring} transition hover:shadow-md`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${meta.cls}`}>
                      {initials(r.display_name, r.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-display text-base font-bold truncate">
                          {r.display_name || "—"}
                          {isSelf && <span className="mr-1 text-[10px] font-normal text-muted-foreground">(أنت)</span>}
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
                          <Icon className="h-3 w-3" /> {meta.label}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground" dir="ltr">{r.email || "—"}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        مسجَّل منذ {new Date(r.created_at).toLocaleDateString("ar-EG-u-nu-latn")}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                    <span className="text-[11px] text-muted-foreground">تغيير الدور</span>
                    {isSelf ? (
                      <span className="text-xs text-muted-foreground">لا يمكنك تعديل دورك</span>
                    ) : (
                      <select
                        disabled={busyId === r.user_id}
                        value={r.role}
                        onChange={(e) => {
                          const newRole = e.target.value as AppRole;
                          if (newRole !== r.role) setPendingChange({ row: r, newRole });
                        }}
                        className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium focus:border-primary focus:outline-none"
                      >
                        <option value="user">مستخدم</option>
                        <option value="control">Control (دعم/صيانة)</option>
                        <option value="manager">مدير</option>
                        <option value="admin">أدمن</option>
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
