import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { crearToken } from "@/lib/panel-auth";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reservas.andreacarriostudio.es";

// Envía un enlace mágico de acceso — solo si ese email tiene un bono utilizable.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = (body?.email ?? "").toString().trim().toLowerCase();
  if (!/\S+@\S+\.\S+/.test(email)) return NextResponse.json({ error: "Email no válido" }, { status: 400 });

  const hoy = new Date().toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from("bonos").select("id")
    .ilike("email", email)
    .gt("creditos_restantes", 0)
    .gte("caduca", hoy)
    .limit(1);

  if (data && data.length) {
    const token = crearToken(email, 20 * 60); // válido 20 min
    const link = `${APP_URL}/mis-clases?acceso=${encodeURIComponent(token)}`;
    const from = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/></head>
<body style="margin:0;background:#f5ede8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5ede8;padding:40px 16px;"><tr><td align="center">
    <table width="100%" style="max-width:480px;background:#fff;border-radius:24px;overflow:hidden;">
      <tr><td style="padding:36px 40px 8px;text-align:center;"><img src="https://andreacarriostudio.vercel.app/logo-email.png" width="140" style="width:140px;" alt="Andrea Carrió Studio"/></td></tr>
      <tr><td style="padding:16px 40px 8px;text-align:center;">
        <h1 style="margin:0 0 12px;font-size:24px;color:#25190f;font-family:Georgia,serif;">Tu acceso al panel 🤎</h1>
        <p style="margin:0;font-size:15px;color:#56423d;line-height:1.7;">Pulsa el botón para entrar y reservar tus clases. El enlace caduca en 20 minutos.</p>
      </td></tr>
      <tr><td style="padding:24px 40px 40px;text-align:center;">
        <a href="${link}" style="display:inline-block;background:#7d2b13;color:#fff8f5;text-decoration:none;font-size:14px;font-weight:700;padding:15px 40px;border-radius:9999px;">Entrar a mi panel →</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
    try {
      await resend.emails.send({ from, to: email, subject: "Tu acceso a Andrea Carrió Studio 🤎", html });
    } catch (e) { console.error("email acceso:", e); }
  }

  // Respuesta genérica: no revelamos si el email tiene bono o no.
  return NextResponse.json({ ok: true });
}
