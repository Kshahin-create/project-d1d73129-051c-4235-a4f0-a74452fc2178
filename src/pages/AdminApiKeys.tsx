import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Copy, KeyRound, Trash2, ShieldAlert } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

const AdminApiKeys = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/");
  }, [loading, user, isAdmin, navigate]);

  const load = async () => {
    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setKeys(data ?? []);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const toggleScope = (s: string) => {
    setScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const create = async () => {
    if (!name.trim()) {
      toast.error("اكتب اسم للمفتاح");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-api-keys", {
      method: "POST",
      body: { name: name.trim(), scopes },
    });
    setCreating(false);
    if (error || data?.error) {
      toast.error(error?.message || data?.error || "فشل الإنشاء");
      return;
    }
    setNewKey(data.data.raw_key);
    setName("");
    setScopes(["read"]);
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm("تعطيل هذا المفتاح؟ لن يعمل بعد ذلك.")) return;
    const { error } = await supabase.functions.invoke(
      `admin-api-keys?id=${id}`,
      { method: "DELETE" },
    );
    if (error) toast.error(error.message);
    else {
      toast.success("تم التعطيل");
      load();
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <KeyRound className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">مفاتيح الـ API</h1>
        </div>

        {newKey && (
          <Card className="mb-6 border-primary/40 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-5 w-5 text-primary" />
                انسخ المفتاح الآن — لن يظهر مرة أخرى
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 rounded-lg bg-background p-3 font-mono text-sm break-all">
                <span className="flex-1">{newKey}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(newKey);
                    toast.success("تم النسخ");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setNewKey(null)}
              >
                حفظت المفتاح، إخفاء
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>إنشاء مفتاح جديد</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">اسم المفتاح</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً: تطبيق الموبايل - الإنتاج"
              />
            </div>
            <div>
              <Label className="mb-2 block">الصلاحيات</Label>
              <div className="flex flex-wrap gap-4">
                {[
                  { v: "read", l: "قراءة (مباني/وحدات/إحصائيات/حجوزات)" },
                  { v: "write", l: "كتابة (إدارة مستأجرين)" },
                  { v: "admin", l: "أدمن (حذف)" },
                ].map((s) => (
                  <label key={s.v} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={scopes.includes(s.v)}
                      onCheckedChange={() => toggleScope(s.v)}
                    />
                    {s.l}
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={create} disabled={creating}>
              {creating ? "جارٍ الإنشاء..." : "إنشاء المفتاح"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>المفاتيح الحالية ({keys.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {keys.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                لا يوجد مفاتيح بعد
              </p>
            ) : (
              <div className="space-y-3">
                {keys.map((k) => (
                  <div
                    key={k.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{k.name}</span>
                        {k.is_active ? (
                          <Badge variant="default">مفعّل</Badge>
                        ) : (
                          <Badge variant="secondary">معطّل</Badge>
                        )}
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        {k.key_prefix}…
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {k.scopes.map((s) => (
                          <Badge key={s} variant="outline">
                            {s}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        آخر استخدام:{" "}
                        {k.last_used_at
                          ? new Date(k.last_used_at).toLocaleString("ar-EG")
                          : "—"}
                      </div>
                    </div>
                    {k.is_active && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => revoke(k.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        تعطيل
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default AdminApiKeys;
