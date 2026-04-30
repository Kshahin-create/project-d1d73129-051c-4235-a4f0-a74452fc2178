import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PhoneField } from "@/components/PhoneField";

export const customerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "الاسم يجب أن يكون 3 أحرف على الأقل")
    .max(100, "الاسم طويل جداً"),
  phone: z
    .string()
    .trim()
    .refine((v) => !!v && isValidPhoneNumber(v), {
      message: "رقم جوال غير صحيح، تأكد من اختيار الدولة وكتابة الرقم كامل",
    }),
  email: z
    .string()
    .trim()
    .email("بريد إلكتروني غير صحيح")
    .max(255)
    .optional()
    .or(z.literal("")),
  business: z
    .string()
    .trim()
    .min(2, "يرجى ذكر النشاط التجاري")
    .max(150),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type CustomerFormData = z.infer<typeof customerSchema>;

interface Props {
  onSubmit: (data: CustomerFormData) => void;
  formId: string;
  defaultValues?: Partial<CustomerFormData>;
}

export const CustomerForm = ({ onSubmit, formId, defaultValues }: Props) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    mode: "onBlur",
    defaultValues,
  });

  // Re-populate when defaultValues arrive asynchronously (e.g., after profile fetch)
  useEffect(() => {
    if (defaultValues && Object.values(defaultValues).some((v) => v !== undefined && v !== "")) {
      reset({ ...defaultValues } as CustomerFormData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(defaultValues)]);

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="الاسم الكامل" required error={errors.fullName?.message}>
        <Input {...register("fullName")} placeholder="محمد عبدالله السالم" autoComplete="name" />
      </Field>

      <Field label="رقم الجوال" required error={errors.phone?.message}>
        <Input
          {...register("phone")}
          type="tel"
          dir="ltr"
          placeholder="+966 5X XXX XXXX"
          autoComplete="tel"
          className="text-left"
        />
      </Field>

      <Field label="البريد الإلكتروني (اختياري)" error={errors.email?.message}>
        <Input
          {...register("email")}
          type="email"
          dir="ltr"
          placeholder="name@example.com"
          autoComplete="email"
          className="text-left"
        />
      </Field>

      <Field label="اسم المنشأة / النشاط التجاري" required error={errors.business?.message}>
        <Input {...register("business")} placeholder="مركز صيانة سيارات / محل قطع غيار..." />
      </Field>

      <Field label="ملاحظات إضافية (اختياري)" error={errors.notes?.message}>
        <Textarea {...register("notes")} rows={3} placeholder="أي تفاصيل أو متطلبات إضافية..." />
      </Field>
    </form>
  );
};

const Field = ({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-medium">
      {label}
      {required && <span className="mr-1 text-destructive">*</span>}
    </Label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);
