import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/supabase";

const FB_PIXEL_ID = "2024231855152441";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

// Teléfono a solo dígitos en formato internacional español (sin +), para hashear.
function normPhone(t: string): string {
  let d = (t || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9) d = "34" + d;
  return d;
}

// Envía el evento Lead a la Conversions API de Meta (servidor → Meta).
// Comparte event_id con el Pixel del navegador para que Meta NO lo cuente dos veces.
// Si no hay token configurado, no hace nada (no rompe la inscripción).
async function sendCapiLead(opts: {
  telefono: string;
  fbclid: string | null;
  fbc: string | null;
  fbp: string | null;
  eventId: string | null;
  eventSourceUrl: string;
  clientIp: string | null;
  userAgent: string | null;
}) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token || !opts.eventId) return;

  const user_data: Record<string, unknown> = {};
  if (opts.telefono) user_data.ph = [sha256(normPhone(opts.telefono))];
  // fbc: cookie _fbc si llega; si no, se construye a partir del fbclid.
  const fbc = opts.fbc || (opts.fbclid ? `fb.1.${Date.now()}.${opts.fbclid}` : null);
  if (fbc) user_data.fbc = fbc;
  if (opts.fbp) user_data.fbp = opts.fbp;
  if (opts.clientIp) user_data.client_ip_address = opts.clientIp;
  if (opts.userAgent) user_data.client_user_agent = opts.userAgent;

  const payload = {
    data: [
      {
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: opts.eventSourceUrl,
        event_id: opts.eventId,
        user_data,
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${FB_PIXEL_ID}/events?access_token=${token}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    if (!res.ok) console.error("CAPI Lead error:", await res.text());
  } catch (e) {
    console.error("CAPI Lead fetch error:", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, apellido, email, telefono, disciplina_adulta, ninas, alergias, origen, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, eventId, fbc, fbp } = body;

    // El formulario corto de la landing solo pide nombre + teléfono (el contacto
    // con la madre es por WhatsApp). apellido/email son NOT NULL en la BD, así que
    // se guardan como cadena vacía cuando no se piden.
    if (!nombre || !telefono) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    // Datos base (siempre existen). La atribución de origen se guarda aparte
    // para poder degradar con elegancia si las columnas aún no se han creado.
    const baseRow = {
      nombre,
      apellido: apellido || "",
      email: email || "",
      telefono,
      disciplina_adulta: disciplina_adulta || null,
      ninas: ninas || [],
      alergias: alergias || null,
    };
    const atribRow = {
      origen: origen || "directo",
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      utm_content: utm_content || null,
      utm_term: utm_term || null,
      fbclid: fbclid || null,
    };

    let { error } = await supabase.from("puertas_abiertas").insert({ ...baseRow, ...atribRow });

    // Si las columnas de atribución todavía no existen en la BD (PGRST204 /
    // "column not found"), reintentamos sin ellas para no perder la reserva.
    // En cuanto se creen las columnas, el origen se guardará automáticamente.
    if (error && (error.code === "PGRST204" || /column/i.test(error.message || ""))) {
      ({ error } = await supabase.from("puertas_abiertas").insert(baseRow));
    }

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Conversión Lead a Meta por servidor (Conversions API). No bloquea si falla.
    const clientIp = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    await sendCapiLead({
      telefono,
      fbclid: fbclid || null,
      fbc: fbc || null,
      fbp: fbp || null,
      eventId: eventId || null,
      eventSourceUrl: req.headers.get("referer") || "https://andreacarriostudio.vercel.app/puertas-abiertas",
      clientIp,
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("puertas-abiertas error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
