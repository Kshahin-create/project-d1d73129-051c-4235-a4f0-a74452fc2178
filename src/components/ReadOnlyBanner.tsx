import { Eye } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const ReadOnlyBanner = () => {
  const { isAdmin, isManager, loading } = useAuth();
  if (loading) return null;
  if (!isManager || isAdmin) return null;
  return (
    <div className="sticky top-0 z-30 flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-900 shadow-sm">
      <Eye className="h-3.5 w-3.5" />
      <span>وضع القراءة فقط — لا يمكنك إجراء أي تعديلات</span>
    </div>
  );
};
