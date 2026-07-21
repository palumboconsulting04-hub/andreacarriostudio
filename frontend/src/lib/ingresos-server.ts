import { supabaseAdmin } from "@/lib/supabase-admin";

// Libro de ingresos del mes para el asesor. Junta TODAS las fuentes de dinero:
//  - Matrículas y bonos cobrados por Stripe (web) → iscrizioni / bonos.
//  - Matrículas y cuotas manuales (bizum/efectivo/tarjeta) que añade Andrea →
//    renovaciones / pagos_manuales.
//  - Cuotas mensuales cobradas por Stripe (desde septiembre) → ingresos_stripe.

export type LineaIngreso = {
  fecha: string;      // YYYY-MM-DD
  concepto: string;   // Matrícula / Bono / Cuota…
  disciplina: string; // Barre / Pilates / Ballet / —
  cliente: string;
  metodo: string;     // Tarjeta (web) / Bizum / Efectivo / Tarjeta
  importe: number;    // €
};

const INSCRITA = ["pagato", "pagado", "activa", "matricula_pagada"];
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const dstr = (d: string) => (d || "").slice(0, 10);
// Disciplina legible para la columna "Clase": barre / pilates / ballet.
const DISC_LABEL: Record<string, string> = {
  "barre-fit": "Barre", "pilates-mat": "Pilates",
  "pre-ballet": "Ballet", "ballet-i": "Ballet", "ballet-ii": "Ballet",
};
const disc = (id: string) => DISC_LABEL[id] ?? (id ? cap(id) : "—");
const discGrupo = (g: string) => (/ballet/i.test(g || "") ? "Ballet" : (g || "—"));

export async function ingresosDelMes(mes: string): Promise<{ lineas: LineaIngreso[]; total: number }> {
  const ini = `${mes}-01`;
  const [y, m] = mes.split("-").map(Number);
  const sig = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return ingresosEntre(ini, sig);
}

// Libro de ingresos entre dos fechas [ini, fin) en formato YYYY-MM-DD. Une todas
// las fuentes (matrículas web, bonos, renovaciones/pagos manuales, cuotas Stripe).
export async function ingresosEntre(ini: string, fin: string): Promise<{ lineas: LineaIngreso[]; total: number }> {
  const sig = fin;

  const [iscr, bonos, renov, pagos, stripeCuotas, cuotasM] = await Promise.all([
    supabaseAdmin.from("iscrizioni").select("nome, cognome, disciplina_id, matricula, stato, created_at").in("stato", INSCRITA).gte("created_at", ini).lt("created_at", sig),
    supabaseAdmin.from("bonos").select("nombre, disciplina_id, precio_pagado, estado, created_at").gte("created_at", ini).lt("created_at", sig),
    supabaseAdmin.from("renovaciones").select("nombre, apellidos, nombre_madre, grupo, importe_matricula, estado_pago, metodo_pago, updated_at").eq("estado_pago", "pagado").neq("metodo_pago", "web").gte("updated_at", ini).lt("updated_at", sig),
    supabaseAdmin.from("pagos_manuales").select("alumna_nombre, concepto, importe, metodo, fecha").gte("fecha", ini).lt("fecha", sig),
    supabaseAdmin.from("ingresos_stripe").select("nombre, email, concepto, importe, metodo, fecha").gte("fecha", ini).lt("fecha", sig),
    supabaseAdmin.from("cuotas").select("mes, importe, metodo, iscrizioni(nome, cognome, disciplina_id)").gte("mes", ini).lt("mes", sig),
  ]);

  const lineas: LineaIngreso[] = [];
  for (const i of iscr.data ?? []) {
    const mat = Number(i.matricula) || 0;
    if (mat > 0) lineas.push({ fecha: dstr(i.created_at as string), concepto: "Matrícula", disciplina: disc(i.disciplina_id as string), cliente: `${i.nome ?? ""} ${i.cognome ?? ""}`.trim() || "—", metodo: "Tarjeta (web)", importe: mat });
  }
  for (const b of bonos.data ?? []) {
    if (b.estado === "cancelado" || b.estado === "reembolsado") continue;
    const imp = Number(b.precio_pagado) || 0;
    if (imp > 0) lineas.push({ fecha: dstr(b.created_at as string), concepto: "Bono", disciplina: disc(b.disciplina_id as string), cliente: (b.nombre as string) || "—", metodo: "Tarjeta (web)", importe: imp });
  }
  for (const r of renov.data ?? []) {
    const imp = Number(r.importe_matricula) || 0;
    if (imp > 0) lineas.push({ fecha: dstr(r.updated_at as string), concepto: "Matrícula", disciplina: discGrupo(r.grupo as string), cliente: `${r.nombre ?? ""} ${r.apellidos ?? ""}`.trim() || (r.nombre_madre as string) || "—", metodo: cap((r.metodo_pago as string) || "efectivo"), importe: imp });
  }
  for (const p of pagos.data ?? []) {
    const imp = Number(p.importe) || 0;
    if (imp > 0) lineas.push({ fecha: dstr(p.fecha as string), concepto: (p.concepto as string) || "Cuota", disciplina: "—", cliente: (p.alumna_nombre as string) || "—", metodo: cap((p.metodo as string) || "efectivo"), importe: imp });
  }
  for (const s of stripeCuotas.data ?? []) {
    const imp = Number(s.importe) || 0;
    if (imp > 0) lineas.push({ fecha: dstr(s.fecha as string), concepto: (s.concepto as string) || "Cuota", disciplina: "—", cliente: (s.nombre as string) || (s.email as string) || "—", metodo: cap((s.metodo as string) || "tarjeta"), importe: imp });
  }
  // Cuotas mensuales marcadas a mano (tabla cuotas). El mes de la cuota es la fecha.
  const MES_NOM = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  for (const c of cuotasM.data ?? []) {
    const imp = Number(c.importe) || 0;
    if (imp <= 0) continue;
    const isc = c.iscrizioni as { nome?: string; cognome?: string; disciplina_id?: string } | null;
    const fecha = dstr(c.mes as string);
    const mm = Number(fecha.split("-")[1]);
    lineas.push({ fecha, concepto: `Cuota ${MES_NOM[mm - 1] ?? ""}`.trim(), disciplina: disc(isc?.disciplina_id ?? ""), cliente: `${isc?.nome ?? ""} ${isc?.cognome ?? ""}`.trim() || "—", metodo: cap((c.metodo as string) || "efectivo"), importe: imp });
  }

  lineas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.concepto.localeCompare(b.concepto));
  const total = lineas.reduce((acc, l) => acc + l.importe, 0);
  return { lineas, total };
}

// CSV para Excel/Sheets: separador ";", decimal con coma y BOM para los acentos.
export function ingresosCSV(lineas: LineaIngreso[], total: number): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const num = (n: number) => n.toFixed(2).replace(".", ",");
  const filas = [
    ["Fecha", "Concepto", "Clase", "Cliente", "Método", "Importe (€)"].map(esc).join(";"),
    ...lineas.map(l => [l.fecha, l.concepto, l.disciplina, l.cliente, l.metodo, num(l.importe)].map(esc).join(";")),
    ["", "", "", "", "TOTAL", num(total)].map(esc).join(";"),
  ];
  return "﻿" + filas.join("\r\n");
}
