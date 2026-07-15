import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { ingresosDelMes, ingresosCSV } from "@/lib/ingresos-server";

const resend = new Resend(process.env.RESEND_API_KEY);

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

// Envía por email la hoja de ingresos del mes (CSV adjunto) al asesor. Solo admin.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const mes = (body?.mes ?? "").toString();
  const email = (body?.email ?? "").toString().trim().toLowerCase();
  if (!/^\d{4}-\d{2}$/.test(mes)) return NextResponse.json({ error: "Mes inválido" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "El email del asesor no es válido." }, { status: 400 });

  const { lineas, total } = await ingresosDelMes(mes);
  const csv = ingresosCSV(lineas, total);
  const [y, m] = mes.split("-");
  const nombreMes = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const totalStr = total.toFixed(2).replace(".", ",");
  const from = process.env.FROM_EMAIL ?? "onboarding@resend.dev";

  try {
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: `Ingresos ${nombreMes} — Andrea Carrió Studio`,
      html: `<div style="font-family:Arial,sans-serif;color:#333;max-width:520px;margin:0 auto;padding:24px;">
        <p>Hola,</p>
        <p>Adjunto la hoja de ingresos de <strong>${nombreMes}</strong> de Andrea Carrió Studio.</p>
        <p><strong>${lineas.length}</strong> ingresos · Total: <strong>${totalStr} €</strong></p>
        <p style="color:#888;">El archivo es un CSV que se abre en Excel o Google Sheets.</p>
        <p>Un saludo,<br/>Andrea Carrió Studio</p>
      </div>`,
      attachments: [{ filename: `ingresos-${mes}.csv`, content: Buffer.from(csv, "utf-8") }],
    });
    if (error) throw error;
  } catch (e) {
    console.error("enviar ingresos asesor:", e);
    return NextResponse.json({ error: "No se pudo enviar el email." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, total, lineas: lineas.length });
}
