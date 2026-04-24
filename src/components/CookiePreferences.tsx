import { useEffect, useState } from "react";
import { Cookie, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "cookie-preferences";

type Preferences = {
  essential: boolean; // always true
  analytics: boolean;
  marketing: boolean;
  decidedAt: string | null;
};

const defaultPrefs: Preferences = {
  essential: true,
  analytics: false,
  marketing: false,
  decidedAt: null,
};

/**
 * قسم تفضيلات ملفات تعريف الارتباط (موافقة / رفض)
 * Cookie consent preferences section with save action.
 */
export const CookiePreferences = () => {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);
  const [saved, setSaved] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Preferences;
        setPrefs({ ...defaultPrefs, ...parsed, essential: true });
        setSaved(Boolean(parsed.decidedAt));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (next: Preferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const handleSave = () => {
    const next: Preferences = { ...prefs, decidedAt: new Date().toISOString() };
    setPrefs(next);
    persist(next);
    setSaved(true);
    toast({
      title: "تم حفظ تفضيلاتك",
      description: "سيتم تطبيق إعداداتك لملفات تعريف الارتباط على هذا الجهاز.",
    });
  };

  const handleAcceptAll = () => {
    const next: Preferences = {
      essential: true,
      analytics: true,
      marketing: true,
      decidedAt: new Date().toISOString(),
    };
    setPrefs(next);
    persist(next);
    setSaved(true);
    toast({ title: "تم قبول جميع ملفات تعريف الارتباط" });
  };

  const handleRejectAll = () => {
    const next: Preferences = {
      essential: true,
      analytics: false,
      marketing: false,
      decidedAt: new Date().toISOString(),
    };
    setPrefs(next);
    persist(next);
    setSaved(true);
    toast({ title: "تم رفض ملفات تعريف الارتباط الاختيارية" });
  };

  return (
    <div className="rounded-xl border border-border bg-background p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-foreground">
          <Cookie className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-lg font-bold text-foreground">إدارة ملفات تعريف الارتباط</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            اختر نوع ملفات تعريف الارتباط التي توافق على استخدامها أثناء تصفّحك للموقع.
          </p>
        </div>
        {saved && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-1 text-xs text-accent-foreground">
            <Check className="h-3 w-3" />
            محفوظ
          </span>
        )}
      </div>

      <div className="space-y-3">
        <PreferenceRow
          title="ملفات أساسية"
          description="ضرورية لعمل الموقع ولا يمكن تعطيلها."
          checked={true}
          disabled
        />
        <PreferenceRow
          title="ملفات التحليلات"
          description="تساعدنا على فهم كيفية استخدام الموقع لتحسين التجربة."
          checked={prefs.analytics}
          onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
        />
        <PreferenceRow
          title="ملفات تسويقية"
          description="تُستخدم لعرض محتوى مخصّص بناءً على اهتماماتك."
          checked={prefs.marketing}
          onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))}
        />
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button variant="outline" size="sm" onClick={handleRejectAll}>
          رفض الاختياري
        </Button>
        <Button variant="outline" size="sm" onClick={handleAcceptAll}>
          قبول الكل
        </Button>
        <Button size="sm" onClick={handleSave}>
          حفظ التفضيل
        </Button>
      </div>
    </div>
  );
};

const PreferenceRow = ({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) => (
  <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-3">
    <div className="flex-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={(v) => onChange?.(Boolean(v))}
      aria-label={title}
    />
  </div>
);
