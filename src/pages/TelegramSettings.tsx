import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Send, Copy, Trash2, Bell, BellOff, RefreshCw } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Sub = { chat_id: number; display_name: string | null; subscriptions: string[]; muted_until: string | null; created_at: string };

const TelegramSettings = () => {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.rpc("list_my_telegram_links");
    setSubs((data as Sub[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    const { data, error } = await supabase.rpc("create_telegram_link_token");
    if (error) return toast.error(error.message);
    setToken(data as string);
  };
  const unlink = async (chat_id: number) => {
    const { error } = await supabase.rpc("unlink_my_telegram", { _chat_id: chat_id });
    if (error) return toast.error(error.message);
    toast.success("تم إلغاء الربط");
    load();
  };
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("تم النسخ"); };

  const botUsername = "MniCity_Bot"; // change if different
  const startCmd = token ? `/start ${token}` : "";
  const startUrl = token ? `https://t.me/${botUsername}?start=${token}` : "";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container-tight py-10">
        <div className="mx-auto max-w-2xl">
          <Link to="/profile" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-4 w-4" /> العودة للحساب
          </Link>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Send className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display text-xl font-extrabold">ربط تيليجرام</h1>
                <p className="text-xs text-muted-foreground">استلم الإشعارات وتحكّم في النظام عبر بوت تيليجرام</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background p-4">
              <h2 className="mb-2 font-bold">إضافة جهاز جديد</h2>
              <ol className="mb-4 space-y-1 text-sm text-muted-foreground">
                <li>1. افتح بوت تيليجرام: <a href={`https://t.me/${botUsername}`} target="_blank" className="text-primary underline">@{botUsername}</a></li>
                <li>2. اضغط زرار <b>توليد كود</b> هنا</li>
                <li>3. ابعت الكود اللي ظهر للبوت</li>
              </ol>
              {!token ? (
                <button onClick={generate} className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                  توليد كود ربط
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <code dir="ltr" className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm">{startCmd}</code>
                    <button onClick={() => copy(startCmd)} className="rounded-lg border border-border p-2"><Copy className="h-4 w-4" /></button>
                  </div>
                  <a href={startUrl} target="_blank" className="block rounded-xl bg-primary px-4 py-2 text-center text-sm font-bold text-primary-foreground">
                    افتح في تيليجرام مباشرة
                  </a>
                  <p className="text-xs text-muted-foreground">⚠️ صالح لمدة 15 دقيقة فقط</p>
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold">الأجهزة المربوطة</h2>
                <button onClick={load} className="rounded-lg border border-border p-1.5"><RefreshCw className="h-3.5 w-3.5" /></button>
              </div>
              {loading ? (
                <p className="text-center text-sm text-muted-foreground py-6">جاري التحميل...</p>
              ) : subs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">لا يوجد أجهزة مربوطة</p>
              ) : (
                <div className="space-y-2">
                  {subs.map((s) => (
                    <div key={s.chat_id} className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                      <div>
                        <div className="font-bold">{s.display_name || `Chat ${s.chat_id}`}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {s.muted_until && new Date(s.muted_until) > new Date() ? (
                            <><BellOff className="h-3 w-3" /> صامت حتى {new Date(s.muted_until).toLocaleString("ar-EG")}</>
                          ) : (
                            <><Bell className="h-3 w-3" /> {s.subscriptions.length} نوع إشعار</>
                          )}
                        </div>
                      </div>
                      <button onClick={() => unlink(s.chat_id)} className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
              <p className="mb-2 font-bold text-foreground">💡 أوامر البوت المتاحة:</p>
              <code dir="ltr" className="block leading-6">
                /stats /unpaid /units /booking &lt;id&gt;<br/>
                /invoice &lt;num&gt; /tenant &lt;name&gt; /search &lt;q&gt;<br/>
                /expiring /overdue /mute &lt;hours&gt; /unmute<br/>
                /subs /sub &lt;type&gt; /unsub &lt;type&gt; /unlink
              </code>
              <p className="mt-2">أو اسأل بلغتك: «كم حجوزات اليوم؟» — البوت بيرد بذكاء اصطناعي</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TelegramSettings;
