import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDeSesion } from "@/lib/panel-auth";

const DISC: Record<string, string> = {
  "barre-fit": "Barre Fit", "pilates-mat": "Pilates Mat",
  "pre-ballet": "Pre-Ballet", "ballet-i": "Ballet I", "ballet-ii": "Ballet II",
};
function metodoLabel(m: string | null | undefined): string {
  const M: Record<string, string> = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia", bizum: "Bizum", web: "Tarjeta (web)" };
  return M[(m ?? "").toLowerCase()] ?? "Tarjeta";
}
const esc = (s: string) => s.replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));

// GET ?id=bono_<uuid> | matricula_<uuid> | stripe_<uuid>
// Devuelve el HTML del justificante de pago, solo si el pago es de la alumna logueada.
export async function GET(req: NextRequest) {
  const emailSesion = await emailDeSesion();
  if (!emailSesion) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("id") || "";
  const idx = raw.indexOf("_");
  const tipo = idx > 0 ? raw.slice(0, idx) : "";
  const uuid = idx > 0 ? raw.slice(idx + 1) : "";
  if (!tipo || !uuid) return NextResponse.json({ error: "Falta el id" }, { status: 400 });

  let cliente = "", concepto = "", importe = 0, metodo = "", fecha = "", emailDueno = "";

  if (tipo === "bono") {
    const { data } = await supabaseAdmin.from("bonos").select("nombre, email, disciplina_id, creditos_totales, precio_pagado, created_at").eq("id", uuid).single();
    if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    emailDueno = (data.email as string) || "";
    cliente = (data.nombre as string) || "";
    concepto = `Bono de ${data.creditos_totales} ${data.creditos_totales === 1 ? "clase" : "clases"} · ${DISC[data.disciplina_id as string] ?? data.disciplina_id}`;
    importe = Number(data.precio_pagado) || 0;
    metodo = "Tarjeta";
    fecha = (data.created_at as string).slice(0, 10);
  } else if (tipo === "matricula") {
    const { data } = await supabaseAdmin.from("iscrizioni").select("nome, cognome, email, matricula, metodo_pagamento, created_at").eq("id", uuid).single();
    if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    emailDueno = (data.email as string) || "";
    cliente = `${data.nome ?? ""} ${data.cognome ?? ""}`.trim();
    concepto = "Matrícula";
    importe = Number(data.matricula) || 0;
    metodo = metodoLabel(data.metodo_pagamento as string);
    fecha = (data.created_at as string).slice(0, 10);
  } else if (tipo === "stripe") {
    const { data } = await supabaseAdmin.from("ingresos_stripe").select("nombre, email, importe, concepto, metodo, fecha").eq("id", uuid).single();
    if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    emailDueno = (data.email as string) || "";
    cliente = (data.nombre as string) || "";
    concepto = (data.concepto as string) || "Pago";
    importe = Number(data.importe) || 0;
    metodo = metodoLabel(data.metodo as string);
    fecha = (data.fecha as string).slice(0, 10);
  } else {
    return NextResponse.json({ error: "Tipo no válido" }, { status: 400 });
  }

  // Comprobación de propiedad: el pago debe ser del correo de la sesión.
  if (emailDueno.toLowerCase() !== emailSesion.toLowerCase()) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const ref = "ACS-" + uuid.replace(/-/g, "").slice(-6).toUpperCase();
  const fechaTxt = new Date(fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const imp = importe.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Justificante ${esc(ref)} — Andrea Carrió Studio</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;background:#f5ede8;color:#25190f;padding:24px}
  .doc{max-width:600px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(37,25,15,.10)}
  .head{padding:28px 32px;background:linear-gradient(135deg,#fff0eb,#fff8f5);border-bottom:1px solid #f0ddd5}
  .brand{font-size:20px;font-weight:700;color:#7d2b13;letter-spacing:.5px}
  .fiscal{font-size:12px;color:#89726c;margin-top:6px;line-height:1.5}
  .body{padding:28px 32px}
  h1{font-size:15px;text-transform:uppercase;letter-spacing:2px;color:#7d2b13;margin-bottom:4px}
  .ref{font-size:13px;color:#89726c;margin-bottom:22px}
  .row{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid #f3e9e4;font-size:14px}
  .row .k{color:#89726c}.row .v{font-weight:600;text-align:right}
  .total{display:flex;justify-content:space-between;align-items:center;margin-top:20px;padding:16px 20px;background:#7d2b13;color:#fff8f5;border-radius:14px}
  .total .l{font-size:13px;text-transform:uppercase;letter-spacing:1px}.total .n{font-size:22px;font-weight:700}
  .paid{display:inline-block;margin-top:16px;padding:6px 14px;border-radius:9999px;background:#e8f5e9;color:#2e7d32;font-size:12px;font-weight:700}
  .foot{padding:18px 32px;font-size:11px;color:#a2938d;text-align:center;border-top:1px solid #f0ddd5;line-height:1.6}
  .btn{display:block;width:100%;max-width:600px;margin:18px auto 0;padding:14px;border:0;border-radius:14px;background:#7d2b13;color:#fff8f5;font-size:14px;font-weight:700;cursor:pointer}
  .topbar{max-width:600px;margin:0 auto 14px}
  .back{display:inline-block;padding:10px 18px;border-radius:9999px;background:#fff;border:1.5px solid #7d2b13;color:#7d2b13;font-size:14px;font-weight:700;text-decoration:none}
  @media print{body{background:#fff;padding:0}.doc{box-shadow:none;border-radius:0}.btn,.topbar{display:none}}
</style></head>
<body>
  <div class="topbar"><a class="back" href="/mis-clases" onclick="if(window.history.length>1){window.history.back();return false;}">← Volver a Mis clases</a></div>
  <div class="doc">
    <div class="head">
      <div class="brand">Andrea Carrió Studio</div>
      <div class="fiscal">Andrea Carrió Caselles · NIF 53947178B<br/>C/ Motilla del Palancar 34 bajo, 46019 Valencia</div>
    </div>
    <div class="body">
      <h1>Justificante de pago</h1>
      <div class="ref">Referencia ${esc(ref)}</div>
      <div class="row"><span class="k">Fecha</span><span class="v">${esc(fechaTxt)}</span></div>
      <div class="row"><span class="k">Cliente</span><span class="v">${esc(cliente || "—")}</span></div>
      <div class="row"><span class="k">Concepto</span><span class="v">${esc(concepto)}</span></div>
      <div class="row"><span class="k">Método de pago</span><span class="v">${esc(metodo)}</span></div>
      <div class="total"><span class="l">Total pagado</span><span class="n">${esc(imp)}</span></div>
      <span class="paid">✓ Pagado</span>
    </div>
    <div class="foot">Documento justificativo de pago emitido por Andrea Carrió Studio. No constituye factura.<br/>Gracias por confiar en nosotras 🤎</div>
  </div>
  <button class="btn" onclick="window.print()">Descargar / Imprimir</button>
</body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
