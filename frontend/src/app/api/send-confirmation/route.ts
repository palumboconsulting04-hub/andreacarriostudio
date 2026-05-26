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
  metodoPago: string;
}

const METODO_LABEL: Record<string, string> = {
  "en-escuela": "En la escuela",
  "tarjeta": "Tarjeta de crédito",
  "google-pay": "Google Pay",
  "apple-pay": "Apple Pay",
  "paypal": "PayPal",
};

function buildHtml(data: InscripcionEmailData): string {
  const { nombre, apellido, inscripciones, totalMensual, metodoPago } = data;
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmación de inscripción</title>
</head>
<body style="margin:0;padding:0;background:#f5ede8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5ede8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(37,25,15,0.10);">

          <!-- Logo -->
          <tr>
            <td style="padding:40px 32px 8px;text-align:center;">
              <div style="width:68px;height:68px;border-radius:50%;background:#7d2b13;margin:0 auto 14px;line-height:68px;text-align:center;">
                <span style="font-size:24px;color:#ffffff;font-style:italic;font-family:Georgia,'Times New Roman',serif;letter-spacing:1px;">ac</span>
              </div>
              <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#89726c;font-weight:600;">Andrea Carrió Studio</p>
              <p style="margin:3px 0 0;font-size:10px;color:#bcb0ab;letter-spacing:1px;">Alfauir &middot; Valencia</p>
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td style="padding:28px 40px 32px;text-align:center;">
              <h1 style="margin:0 0 14px;font-size:28px;font-weight:600;color:#25190f;font-family:Georgia,'Times New Roman',serif;line-height:1.35;">¡Gracias por unirte a<br>Andrea Carrió Studio!</h1>
              <p style="margin:0;font-size:14px;color:#56423d;line-height:1.75;">
                Hola <strong>${saludo}</strong>, estamos encantadas de recibirte en nuestra comunidad. Tu camino hacia el movimiento consciente, la gracia y el bienestar comienza aquí.
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
                      <tr>
                        <td style="font-size:13px;color:#56423d;padding-bottom:10px;">Método de pago</td>
                        <td style="font-size:13px;color:#25190f;font-weight:600;text-align:right;padding-bottom:10px;">${METODO_LABEL[metodoPago] ?? metodoPago}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#56423d;border-top:1px solid #f0ddd5;padding-top:10px;">Estado</td>
                        <td style="text-align:right;border-top:1px solid #f0ddd5;padding-top:10px;">
                          ${metodoPago === "tarjeta" || metodoPago === "google-pay" || metodoPago === "apple-pay" || metodoPago === "paypal"
                            ? `<span style="background:#e8f5e9;color:#2e7d32;font-size:12px;font-weight:600;padding:4px 12px;border-radius:9999px;">Pagado &middot; ${totalMensual}€</span>`
                            : `<span style="background:#fff3e0;color:#e65100;font-size:12px;font-weight:600;padding:4px 12px;border-radius:9999px;">Pendiente &middot; ${totalMensual}€/mes</span>`
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
                      <strong style="color:#7d2b13;">¡Todo listo!</strong> Hemos recibido tu pago correctamente. En breve nos ponemos en contacto contigo para confirmar los horarios y darte la bienvenida en persona.
                    </p>
                    ` : `
                    <p style="margin:0;font-size:13px;color:#56423d;line-height:1.6;">
                      <strong style="color:#7d2b13;">Recuerda:</strong> has elegido pagar en la escuela. Tu plaza queda reservada, pero la inscripción se confirma definitivamente cuando abones la primera cuota de <strong>${totalMensual}€</strong> directamente en el estudio.
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
              <a href="https://andrecarriostudio.es" style="display:inline-block;background:#7d2b13;color:#ffffff;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:15px 36px;border-radius:9999px;">
                Visita nuestro estudio &rarr;
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fff8f5;border-top:1px solid #f0ddd5;padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#25190f;">Andrea Carrió Studio</p>
              <p style="margin:5px 0 0;font-size:11px;color:#89726c;">C/ Motilla del Palancar 34, Alfauir (Valencia)</p>
              <p style="margin:3px 0 0;font-size:11px;color:#89726c;">andreacarriostudio@gmail.com</p>
              <p style="margin:16px 0 6px;">
                <a href="https://andrecarriostudio.es" style="color:#89726c;text-decoration:none;font-size:10px;margin:0 8px;">Privacidad</a>
                <a href="https://andrecarriostudio.es" style="color:#89726c;text-decoration:none;font-size:10px;margin:0 8px;">Términos</a>
                <a href="mailto:andreacarriostudio@gmail.com" style="color:#89726c;text-decoration:none;font-size:10px;margin:0 8px;">Contacto</a>
              </p>
              <p style="margin:6px 0 0;font-size:10px;color:#bcb0ab;letter-spacing:1px;">© 2025 ANDREA CARRIÓ STUDIO · ALFAUIR, VALENCIA</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export async function POST(req: NextRequest) {
  try {
    const data: InscripcionEmailData = await req.json();

    if (!data.email || !data.nombre) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    const { error } = await resend.emails.send({
      from: process.env.FROM_EMAIL ?? "onboarding@resend.dev",
      to: data.email,
      subject: "¡Bienvenida a Andrea Carrió Studio! Tu inscripción está confirmada",
      html: buildHtml(data),
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("send-confirmation error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
