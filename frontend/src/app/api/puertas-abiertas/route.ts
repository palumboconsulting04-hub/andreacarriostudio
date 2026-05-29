import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, apellido, email, telefono, disciplina_adulta, ninas, alergias } = body;

    if (!nombre || !apellido || !email || !telefono) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    const { error } = await supabase.from("puertas_abiertas").insert({
      nombre,
      apellido,
      email,
      telefono,
      disciplina_adulta: disciplina_adulta || null,
      ninas: ninas || [],
      alergias: alergias || null,
    });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    const from = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
    if (adminEmail) {
      const ninasList = (ninas as { nombre: string; edad: string }[]) ?? [];
      const ninasHtml = ninasList.length > 0
        ? ninasList.map(n => `${n.nombre} (${n.edad})`).join(", ")
        : "—";
      const DISC_LABEL: Record<string, string> = {
        pilates: "Pilates",
        barre: "Barre",
        "ballet-adultas": "Ballet Adultas",
        "acompanar": "Solo acompañar",
      };
      const discLabel = DISC_LABEL[disciplina_adulta] ?? disciplina_adulta ?? "—";

      await resend.emails.send({
        from,
        to: adminEmail,
        subject: `Nueva inscripción Puertas Abiertas — ${nombre} ${apellido}`,
        html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:520px;margin:0 auto;padding:24px;">
<h2 style="margin:0 0 4px;color:#7d2b13;">Puertas Abiertas — Nueva reserva</h2>
<p style="margin:0 0 20px;font-size:13px;color:#888;">${new Date().toLocaleString("es-ES")}</p>
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="font-size:13px;color:#666;padding-bottom:6px;">Nombre</td><td style="font-size:13px;font-weight:600;text-align:right;">${nombre} ${apellido}</td></tr>
  <tr><td style="font-size:13px;color:#666;padding-bottom:6px;">Email</td><td style="font-size:13px;text-align:right;"><a href="mailto:${email}">${email}</a></td></tr>
  <tr><td style="font-size:13px;color:#666;padding-bottom:6px;">Teléfono</td><td style="font-size:13px;text-align:right;">${telefono}</td></tr>
  <tr><td style="font-size:13px;color:#666;padding-bottom:6px;">Quiere probar</td><td style="font-size:13px;font-weight:600;text-align:right;">${discLabel}</td></tr>
  <tr><td style="font-size:13px;color:#666;padding-bottom:6px;">Niñas</td><td style="font-size:13px;text-align:right;">${ninasHtml}</td></tr>
  <tr><td style="font-size:13px;color:#666;">Alergias</td><td style="font-size:13px;text-align:right;">${alergias || "—"}</td></tr>
</table>
</body></html>`,
      }).catch(e => console.error("Admin PA notification error:", e));
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("puertas-abiertas error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
