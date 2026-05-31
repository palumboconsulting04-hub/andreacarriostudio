import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface InscripcionEmailData {
  email: string;
  nombre: string;
  apellido: string;
  inscripciones: {
    disciplina: string;
    plan: string;
    precio: number;
    horarios: string[];
    alumna?: { nombre: string; apellido: string };
  }[];
  totalMensual: number;
  matricula: number;
  metodoPago: string;
  notifyAdmin?: boolean;
}

const METODO_LABEL: Record<string, string> = {
  "en-escuela": "En la escuela",
  "tarjeta": "Tarjeta de crédito",
  "google-pay": "Google Pay",
  "apple-pay": "Apple Pay",
  "paypal": "PayPal",
};

export function buildEmailHtml(data: InscripcionEmailData): string {
  return buildHtml(data);
}

function buildHtml(data: InscripcionEmailData): string {
  const { nombre, apellido, inscripciones, totalMensual, matricula, metodoPago } = data;
  const esNinas = inscripciones.some(i => i.alumna);
  const saludo = esNinas ? `${nombre} ${apellido}` : nombre;

  const inscripcionesHtml = inscripciones.map(ins => `
    <tr>
      <td style="padding:0 32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <!-- Disciplina -->
            <td width="48%" valign="top" style="background:#fff1e9;border-radius:16px;padding:18px 16px;">
              <p style="margin:0 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#89726c;font-weight:700;">&#127939; Disciplina</p>
              <p style="margin:0;font-size:17px;font-weight:700;color:#25190f;line-height:1.3;">${ins.disciplina}</p>
              <p style="margin:4px 0 0;font-size:12px;color:#89726c;">${ins.plan}</p>
              ${ins.alumna ? `<p style="margin:10px 0 0;font-size:12px;color:#7d2b13;font-weight:600;">Alumna: ${ins.alumna.nombre} ${ins.alumna.apellido}</p>` : ""}
            </td>
            <td width="4%"></td>
            <!-- Horarios -->
            <td width="48%" valign="top" style="background:#fff1e9;border-radius:16px;padding:18px 16px;">
              <p style="margin:0 0 8px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#89726c;font-weight:700;">&#128337; Horarios</p>
              ${ins.horarios.length > 0
                ? ins.horarios.map(h => `<p style="margin:0 0 4px;font-size:13px;color:#25190f;font-weight:500;">${h}</p>`).join("")
                : `<p style="margin:0;font-size:13px;color:#89726c;font-style:italic;">Por confirmar</p>`
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmación de inscripción</title>
  <link rel="icon" href="https://andreacarriostudio.vercel.app/logo-icon.png" />
</head>
<body style="margin:0;padding:0;background:#f5ede8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5ede8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(37,25,15,0.10);">

          <!-- Logo -->
          <tr>
            <td style="padding:40px 32px 8px;text-align:center;background:#ffffff;">
              <img src="https://andreacarriostudio.vercel.app/logo-email.png" alt="Andrea Carrió Studio" width="160" style="display:block;margin:0 auto;width:160px;max-width:160px;background:#ffffff;" />
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td style="padding:28px 40px 32px;text-align:center;">
              <h1 style="margin:0 0 14px;font-size:28px;font-weight:600;color:#25190f;font-family:Georgia,'Times New Roman',serif;line-height:1.35;">¡Hola ${saludo}!</h1>
              <p style="margin:0;font-size:15px;color:#56423d;line-height:1.8;">
                Gracias por confiar en nosotras y por querer empezar este camino juntas. Tu plaza está reservada y me hace mucha ilusión verte pronto en el estudio. 🤍
              </p>
            </td>
          </tr>

          <!-- Inscripciones -->
          ${inscripcionesHtml}

          <!-- Resumen de pago -->
          <tr>
            <td style="padding:0 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f5;border:1px solid #f0ddd5;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px 12px;">
                    <p style="margin:0 0 14px;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#89726c;font-weight:700;">&#128179; Resumen de pago</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${matricula > 0 ? `
                      <tr>
                        <td style="font-size:13px;color:#56423d;padding-bottom:6px;">Cuota mensual</td>
                        <td style="font-size:13px;color:#25190f;font-weight:600;text-align:right;padding-bottom:6px;">${totalMensual}€/mes</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#56423d;padding-bottom:10px;">
                          Matrícula <span style="font-size:11px;color:#89726c;">(pago único)</span>
                        </td>
                        <td style="font-size:13px;color:#25190f;font-weight:600;text-align:right;padding-bottom:10px;">${matricula}€</td>
                      </tr>
                      ` : ""}
                      <tr>
                        <td style="font-size:13px;color:#56423d;padding-bottom:10px;">Método de pago</td>
                        <td style="font-size:13px;color:#25190f;font-weight:600;text-align:right;padding-bottom:10px;">${METODO_LABEL[metodoPago] ?? metodoPago}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#56423d;border-top:1px solid #f0ddd5;padding-top:10px;">Estado</td>
                        <td style="text-align:right;border-top:1px solid #f0ddd5;padding-top:10px;">
                          ${metodoPago === "tarjeta" || metodoPago === "google-pay" || metodoPago === "apple-pay" || metodoPago === "paypal"
                            ? `<span style="background:#e8f5e9;color:#2e7d32;font-size:12px;font-weight:600;padding:4px 12px;border-radius:9999px;">Pagado &middot; ${totalMensual + matricula}€</span>`
                            : `<span style="background:#fff3e0;color:#e65100;font-size:12px;font-weight:600;padding:4px 12px;border-radius:9999px;">Pendiente &middot; ${totalMensual}€/mes${matricula > 0 ? ` + ${matricula}€ matrícula` : ""}</span>`
                          }
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Aviso -->
          <tr>
            <td style="padding:0 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8f5;border-left:3px solid #7d2b13;border-radius:0 12px 12px 0;">
                <tr>
                  <td style="padding:14px 18px;">
                    ${metodoPago === "tarjeta" || metodoPago === "google-pay" || metodoPago === "apple-pay" || metodoPago === "paypal" ? `
                    <p style="margin:0;font-size:13px;color:#56423d;line-height:1.6;">
                      <strong style="color:#7d2b13;">¡Perfecto!</strong> Tu pago está confirmado. Te espero pronto en el estudio. 🤍
                    </p>
                    ` : `
                    <p style="margin:0;font-size:13px;color:#56423d;line-height:1.6;">
                      <strong style="color:#7d2b13;">Recuerda</strong> traer el pago el primer día: ${matricula > 0 ? `<strong>${matricula}€</strong> de matrícula + ` : ""}<strong>${totalMensual}€</strong>/mes de cuota. Cualquier duda estoy por aquí. 🤍
                    </p>
                    `}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 40px;text-align:center;">
              <p style="margin:0 0 16px;font-size:13px;color:#56423d;">Únete a nuestro grupo de WhatsApp para estar al tanto de todo:</p>
              <a href="https://chat.whatsapp.com/Gi2SUxvVc0xCqtw8egpkQu?mode=gi_t" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:1px;padding:15px 36px;border-radius:9999px;">
                Unirme al grupo &rarr;
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fff8f5;border-top:1px solid #f0ddd5;padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#25190f;">Andrea Carrió Studio</p>
              <p style="margin:5px 0 0;font-size:11px;color:#89726c;">C/ Motilla del Palancar 34, Alfauir (Valencia)</p>
              <p style="margin:3px 0 0;font-size:11px;color:#89726c;">andreacarriostudio@gmail.com</p>
              <p style="margin:16px 0 0;font-size:10px;color:#bcb0ab;letter-spacing:1px;">© 2025 ANDREA CARRIÓ STUDIO · ALFAUIR, VALENCIA</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function buildAdminNotificationHtml(data: InscripcionEmailData): string {
  const metodo = METODO_LABEL[data.metodoPago] ?? data.metodoPago;
  const total = data.totalMensual + (data.matricula ?? 0);
  const rows = data.inscripciones.map(ins => {
    const alumna = ins.alumna ? ` · Alumna: ${ins.alumna.nombre} ${ins.alumna.apellido}` : "";
    const horarios = ins.horarios.length > 0 ? ins.horarios.join(", ") : "Sin horario";
    return `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;">${ins.disciplina} — ${ins.plan}${alumna}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;">${horarios}</td></tr>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8" /><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /></head><body style="font-family:Arial,sans-serif;color:#333;max-width:520px;margin:0 auto;padding:24px;">
<h2 style="margin:0 0 4px;color:#7d2b13;">Nueva inscripción</h2>
<p style="margin:0 0 20px;font-size:13px;color:#888;">${new Date().toLocaleString("es-ES")}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
  <tr><td style="font-size:13px;color:#666;padding-bottom:4px;">Nombre</td><td style="font-size:13px;font-weight:600;text-align:right;">${data.nombre} ${data.apellido}</td></tr>
  <tr><td style="font-size:13px;color:#666;padding-bottom:4px;">Email</td><td style="font-size:13px;text-align:right;"><a href="mailto:${data.email}">${data.email}</a></td></tr>
  <tr><td style="font-size:13px;color:#666;padding-bottom:4px;">Pago</td><td style="font-size:13px;font-weight:600;text-align:right;">${metodo} · ${total}€${data.matricula > 0 ? ` (incl. ${data.matricula}€ matrícula)` : ""}</td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #7d2b13;">
  <tr><th style="text-align:left;font-size:11px;color:#888;padding:8px 0 4px;">Disciplina / Plan</th><th style="text-align:right;font-size:11px;color:#888;padding:8px 0 4px;">Horarios</th></tr>
  ${rows}
</table>
</body></html>`;
}

export async function POST(req: NextRequest) {
  try {
    const data: InscripcionEmailData = await req.json();

    if (!data.email || !data.nombre) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const from = process.env.FROM_EMAIL ?? "onboarding@resend.dev";

    const { error } = await resend.emails.send({
      from,
      to: data.email,
      subject: "¡Bienvenida a Andrea Carrió Studio! Tu inscripción está confirmada",
      html: buildHtml(data),
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Admin notification (different email, only when triggered from the public form)
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
    console.log("ADMIN_EMAIL=" + (adminEmail ?? "NOT_SET") + " notify=" + data.notifyAdmin);
    if (data.notifyAdmin && adminEmail) {
      const { error: adminError } = await resend.emails.send({
        from,
        to: adminEmail,
        subject: `Nueva inscripción — ${data.nombre} ${data.apellido}`,
        html: buildAdminNotificationHtml(data),
      });
      if (adminError) console.error("Admin notification error:", adminError);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("send-confirmation error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
