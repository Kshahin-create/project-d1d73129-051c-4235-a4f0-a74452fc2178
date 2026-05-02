import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface BookingUnit {
  buildingNumber: number;
  buildingType: string;
  unitNumber: number;
  unitType: string | null;
  area: number;
  activity: string | null;
  price: number;
}

interface BookingPayload {
  booking_id?: string;
  customer: {
    fullName: string;
    phone: string;
    email?: string;
    business: string;
    notes?: string;
  };
  units: BookingUnit[];
  message?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const webhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
    if (!webhookUrl) {
      throw new Error("N8N_WEBHOOK_URL is not configured");
    }

    const body = (await req.json()) as BookingPayload;

    // Basic validation
    if (!body?.customer?.fullName || !body?.customer?.phone) {
      return new Response(
        JSON.stringify({ error: "بيانات العميل ناقصة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!Array.isArray(body.units) || body.units.length === 0) {
      return new Response(
        JSON.stringify({ error: "لا توجد وحدات في الطلب" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalArea = body.units.reduce((s, u) => s + (Number(u.area) || 0), 0);
    const totalPrice = body.units.reduce((s, u) => s + (Number(u.price) || 0), 0);

    const payload = {
      source: "نخبة تسكين - استمارة الحجز",
      submitted_at: new Date().toISOString(),
      customer: body.customer,
      units: body.units,
      totals: {
        units_count: body.units.length,
        total_area: totalArea,
        total_annual_price: totalPrice,
        vat_note: "السعر غير شامل ضريبة القيمة المضافة 15%",
      },
      whatsapp_message: body.message ?? null,
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("n8n webhook failed:", res.status, text);
      return new Response(
        JSON.stringify({ error: `n8n webhook failed [${res.status}]`, details: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, forwarded: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("booking-webhook error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
