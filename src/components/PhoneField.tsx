import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
}

/**
 * Phone input with country selector (flag + dial code).
 * Stores value in E.164 format (e.g. "+966555531084").
 */
export const PhoneField = ({
  value,
  onChange,
  placeholder = "أدخل رقم الجوال",
  className,
  required,
  id,
}: Props) => {
  return (
    <div
      dir="ltr"
      className={cn(
        "phone-field flex w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary",
        className,
      )}
    >
      <PhoneInput
        id={id}
        international
        defaultCountry="SA"
        countryCallingCodeEditable={false}
        value={value || undefined}
        onChange={(v) => onChange(v ?? "")}
        placeholder={placeholder}
        required={required}
        className="phone-input flex-1"
      />
    </div>
  );
};
