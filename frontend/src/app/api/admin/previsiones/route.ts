import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

// ─── Mapeos de grupos a su disciplina real (para leer la capacidad de orari) ───
// Niñas: cada grupo es UN grupo cerrado que va 2 días/semana, así que su
// capacidad real = plazas de una franja (no la suma de las dos). Por eso tomamos
// el máximo de posti_totali entre sus horarios.
const GRUPOS_NINAS = [
  { grupo: "Pre-Ballet", sub: "3–6 años", disciplina: "Pre Ballet 3-6 años", match: "Pre-Ballet" },
  { grupo: "Ballet 1", sub: "7–9 años", disciplina: "Ballet I 7-9 años", match: "Ballet 1" },
  { grupo: "Ballet 2", sub: "10–14 años", disciplina: "Ballet II 10-14 años", match: "Ballet 2" },
];

// Adultas: cada franja es una clase independiente, así que la capacidad de la
// disciplina = suma de plazas de todas sus franjas.
const DISC_ADULTAS = [
  { key: "barre", label: "Barre Fit", disciplina: "Barre Fit" },
  { key: "pilates", label: "Pilates Mat", disciplina: "Pilates Mat" },
];

// Devuelve los datos crudos y verdaderos para la previsión de ocupación.
// El modelo (tasas de conversión / escenarios) se aplica en el cliente, para que
// el selector de escenario sea instantáneo. Aquí solo agregamos lo real.
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [orariRes, renovRes, puertasRes, adultasRes] = await Promise.all([
    supabaseAdmin
      .from("orari")
      .select("posti_totali, attivo, discipline(nome)")
      .eq("attivo", true),
    supabaseAdmin.from("renovaciones").select("grupo, estado_pago"),
    supabaseAdmin.from("puertas_abiertas").select("ninas, confirmacion"),
    supabaseAdmin.from("puertas_abiertas_adultas").select("disciplina, confirmacion"),
  ]);

  if (orariRes.error || renovRes.error || puertasRes.error || adultasRes.error) {
    const msg = orariRes.error?.message || renovRes.error?.message || puertasRes.error?.message || adultasRes.error?.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Capacidad por disciplina, derivada de los horarios activos.
  type OrarioRow = { posti_totali: number | null; discipline: { nome: string } | { nome: string }[] | null };
  const orari = (orariRes.data ?? []) as OrarioRow[];
  const discNombre = (o: OrarioRow): string => {
    const d = o.discipline;
    if (!d) return "";
    return Array.isArray(d) ? (d[0]?.nome ?? "") : d.nome;
  };
  const capMax: Record<string, number> = {}; // máximo (grupos cerrados = niñas)
  const capSum: Record<string, number> = {}; // suma (franjas sueltas = adultas)
  for (const o of orari) {
    const nome = discNombre(o);
    if (!nome) continue;
    const p = o.posti_totali ?? 0;
    capMax[nome] = Math.max(capMax[nome] ?? 0, p);
    capSum[nome] = (capSum[nome] ?? 0) + p;
  }

  // ── Niñas: renovaciones por grupo ──
  const renov = (renovRes.data ?? []) as { grupo: string; estado_pago: string }[];
  // ── Niñas: puertas abiertas (cada niña lleva su grupo en `edad`) ──
  const puertas = (puertasRes.data ?? []) as {
    ninas: { nombre: string; edad: string }[] | null;
    confirmacion: string;
  }[];

  const ninas = GRUPOS_NINAS.map(g => {
    const renovGrupo = renov.filter(r => r.grupo === g.grupo);
    const renovTotal = renovGrupo.length;
    const renovPagadas = renovGrupo.filter(r => r.estado_pago === "pagado").length;
    // Cuenta cada niña cuyo grupo (campo edad) coincide, por estado de confirmación.
    let paConfirma = 0, paPendiente = 0, paNoViene = 0;
    for (const p of puertas) {
      for (const n of p.ninas ?? []) {
        if (!n.edad || !n.edad.includes(g.match)) continue;
        if (p.confirmacion === "confirma") paConfirma++;
        else if (p.confirmacion === "no_viene") paNoViene++;
        else paPendiente++;
      }
    }
    return {
      grupo: g.grupo,
      sub: g.sub,
      capacidad: capMax[g.disciplina] ?? 0,
      renovaciones: renovTotal,
      renovaciones_pagadas: renovPagadas,
      pa_confirma: paConfirma,
      pa_pendiente: paPendiente,
      pa_no_viene: paNoViene,
    };
  });

  // ── Adultas: puertas abiertas por disciplina ──
  const adultasLeads = (adultasRes.data ?? []) as { disciplina: string | null; confirmacion: string }[];
  const contar = (pred: (d: string | null) => boolean, conf: string) =>
    adultasLeads.filter(l => pred(l.disciplina) && (conf === "pendiente" ? l.confirmacion !== "confirma" && l.confirmacion !== "no_viene" : l.confirmacion === conf)).length;

  const adultas = DISC_ADULTAS.map(d => ({
    key: d.key,
    label: d.label,
    capacidad: capSum[d.disciplina] ?? 0,
    // "ambas" cuenta como interés potencial en esta disciplina también.
    pa_confirma: contar(x => x === d.key || x === "ambas", "confirma"),
    pa_pendiente: contar(x => x === d.key || x === "ambas", "pendiente"),
  }));

  // Total de leads adultas únicos (sin doble conteo de "ambas").
  const adultasTotalConfirma = adultasLeads.filter(l => l.confirmacion === "confirma").length;
  const adultasTotalPendiente = adultasLeads.filter(l => l.confirmacion !== "confirma" && l.confirmacion !== "no_viene").length;

  return NextResponse.json({
    data: {
      ninas,
      adultas,
      adultas_total: { pa_confirma: adultasTotalConfirma, pa_pendiente: adultasTotalPendiente },
      generated_at: new Date().toISOString(),
    },
  });
}
