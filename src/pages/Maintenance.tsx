import { Wrench } from "lucide-react";

export default function Maintenance({ message }: { message?: string | null }) {
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Wrench className="h-10 w-10" />
        </div>
        <h1 className="font-display text-3xl font-bold mb-3">الموقع تحت الصيانة</h1>
        <p className="text-muted-foreground leading-relaxed">
          {message?.trim() || "نعمل حالياً على تحسين الموقع. يرجى المحاولة لاحقاً، شكراً لتفهمكم."}
        </p>
      </div>
    </div>
  );
}
