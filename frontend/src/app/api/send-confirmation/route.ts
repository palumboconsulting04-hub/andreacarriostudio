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

  const inscripcionesHtml = inscripciones.map(ins => `
    <div style="background:#fff8f5;border:1px solid #dcc1b9;border-radius:16px;padding:20px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <div>
          <p style="margin:0;font-size:16px;font-weight:600;color:#25190f;">${ins.disciplina}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#89726c;">Plan ${ins.plan}</p>
        </div>
        <p style="margin:0;font-size:18px;font-weight:700;color:#7d2b13;">${ins.precio}€/mes</p>
      </div>
      ${ins.alumna ? `
        <div style="background:#fff1e9;border-radius:10px;padding:10px 14px;margin-bottom:12px;">
          <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#89726c;font-weight:600;">Alumna</p>
          <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#7d2b13;">${ins.alumna.nombre} ${ins.alumna.apellido}</p>
        </div>
      ` : ""}
      ${ins.horarios.length > 0 ? `
        <div>
          <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#89726c;font-weight:600;">Horarios</p>
          ${ins.horarios.map(h => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="width:6px;height:6px;border-radius:50%;background:#7d2b13;display:inline-block;flex-shrink:0;"></span>
              <span style="font-size:13px;color:#25190f;">${h}</span>
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `).join("");

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmación de inscripción</title>
</head>
<body style="margin:0;padding:0;background:#f5ede8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5ede8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(37,25,15,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:#7d2b13;padding:36px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#f5c9b8;font-weight:600;">Andrea Carrió Studio</p>
              <h1 style="margin:10px 0 0;font-size:28px;color:#ffffff;font-weight:300;letter-spacing:1px;">¡Inscripción confirmada!</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">

              <!-- Saludo -->
              <p style="font-size:16px;color:#25190f;margin:0 0 8px;">Hola, <strong>${esNinas ? `${nombre} ${apellido}` : `${nombre}`}</strong></p>
              <p style="font-size:14px;color:#56423d;margin:0 0 28px;line-height:1.6;">
                Tu inscripción ha sido recibida correctamente. En breve nos ponemos en contacto contigo para confirmar los detalles y resolver cualquier duda.
              </p>

              <!-- Inscripciones -->
              <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#89726c;font-weight:600;margin:0 0 14px;">Detalle de tu inscripción</p>
              ${inscripcionesHtml}

              <!-- Total + pago -->
              <div style="background:#fff8f5;border:1px solid #dcc1b9;border-radius:16px;padding:20px;margin-top:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                  <span style="font-size:14px;color:#56423d;">Total mensual</span>
                  <span style="font-size:24px;font-weight:700;color:#7d2b13;">${totalMensual}€</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #dcc1b9;padding-top:12px;">
                  <span style="font-size:12px;color:#89726c;">Método de pago</span>
                  <span style="font-size:13px;font-weight:600;color:#25190f;">${METODO_LABEL[metodoPago] ?? metodoPago}</span>
                </div>
              </div>

              <!-- Aviso -->
              <div style="background:#fff3e0;border-radius:12px;padding:16px;margin-top:20px;border-left:3px solid #e65100;">
                <p style="margin:0;font-size:13px;color:#56423d;line-height:1.5;">
                  <strong style="color:#e65100;">Recuerda:</strong> la plaza queda reservada pero la inscripción se confirma definitivamente con el pago de la primera cuota.
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fff8f5;border-top:1px solid #dcc1b9;padding:24px 32px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#7d2b13;font-weight:600;">Andrea Carrió Studio</p>
              <p style="margin:6px 0 0;font-size:12px;color:#89726c;">C/ Motilla del Palancar 34, Alfauir (Valencia)</p>
              <p style="margin:4px 0 0;font-size:12px;color:#89726c;">andreacarriostudio@gmail.com</p>
              <p style="margin:16px 0 0;font-size:11px;color:#bcb0ab;">Has recibido este email porque completaste un formulario de inscripción en andrecarriostudio.com</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
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
      subject: "Tu inscripción en Andrea Carrió Studio — confirmada ✓",
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
