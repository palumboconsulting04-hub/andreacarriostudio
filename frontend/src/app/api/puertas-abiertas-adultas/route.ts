import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { plantilla, remitente, REPLY_TO } from "@/lib/email-envio";
import { enlaceBaja } from "@/lib/listas-email";

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
    if (!res.ok) console.error("CAPI Lead adultas error:", await res.text());
  } catch (e) {
    console.error("CAPI Lead adultas fetch error:", e);
  }
}

const DISCIPLINAS = new Set(["pilates", "barre", "ambas"]);

const resend = new Resend(process.env.RESEND_API_KEY);
const ESCUELA_WA = "34614679291";

// Email automático a la clienta: la invita a escribirnos por WhatsApp. Así la
// conversación entra en el móvil de Andrea (614679291) y ella toma el control.
async function sendLeadEmail(nombre: string, email: string, base: string) {
  if (!process.env.RESEND_API_KEY) return;
  const waMsg = "¡Hola Andrea! Me interesan las clases de Pilates y Barre 🤎 ¿me cuentas?";
  const waUrl = `https://wa.me/${ESCUELA_WA}?text=${encodeURIComponent(waMsg)}`;
  const cuerpo =
    "Vi que dejaste tus datos interesada en probar Pilates o Barre Fit, y me encantaría ayudarte a empezar.\n\n" +
    "Lo más fácil es que hablemos por WhatsApp: dale al botón, me escribes y te contesto yo misma — te cuento los horarios, los precios y te guardo tu plaza.";
  try {
    await resend.emails.send({
      from: remitente(),
      replyTo: REPLY_TO,
      to: email,
      subject: `¿Empezamos? 🤎`,
      html: plantilla(nombre, cuerpo, enlaceBaja(email, base), { cta: { texto: "Escribirme por WhatsApp", url: waUrl } }),
    });
  } catch (e) {
    console.error("lead email adultas error:", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, telefono, email, disciplina, origen, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, eventId, fbc, fbp, variante, ref } = body;

    // Nombre + teléfono + email: los tres obligatorios.
    const emailNorm = (email || "").trim().toLowerCase();
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm);
    if (!nombre || !telefono || !emailValido) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    const vNum = Number(variante);
    const row = {
      nombre,
      telefono,
      email: emailNorm,
      disciplina: DISCIPLINAS.has(disciplina) ? disciplina : null,
      variante: Number.isInteger(vNum) && vNum >= 0 && vNum < 100 ? vNum : null,
      ref: typeof ref === "string" ? ref.slice(0, 64) : null,
      origen: origen || "directo",
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      utm_content: utm_content || null,
      utm_term: utm_term || null,
      fbclid: fbclid || null,
    };

    const { error } = await supabase.from("puertas_abiertas_adultas").insert(row);
    if (error) {
      console.error("Supabase error adultas:", error);
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
      eventSourceUrl: req.headers.get("referer") || "https://andreacarriostudio.es/puertas-abiertas-adultas",
      clientIp,
      userAgent: req.headers.get("user-agent"),
    });

    // Email automático a la clienta con el botón de WhatsApp. No bloquea si falla.
    const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    await sendLeadEmail(nombre, emailNorm, base);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("puertas-abiertas-adultas error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
