import { supabaseAdmin } from "@/lib/supabase-admin";
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Listas de email VIVAS: se calculan en el momento, nunca se guardan.
// Así, en cuanto alguien compra, desaparece sola y para siempre de la lista:
// es imposible mandarle publicidad a una clienta que ya ha pagado.
//
//   LISTA = interesadas − compradoras − bajas
// ─────────────────────────────────────────────────────────────────────────────

export type SegmentoId = "adultas" | "ninas" | "madres-crosssell";

export const SEGMENTOS: { id: SegmentoId; nombre: string; descripcion: string }[] = [
  {
    id: "adultas",
    nombre: "Adultas · Barre y Pilates",
    descripcion: "Interesadas en clases de adultas. NUNCA reciben promos de ballet infantil.",
  },
  {
    id: "ninas",
    nombre: "Familias de ballet (niñas)",
    descripcion: "Madres/padres interesados en ballet infantil. Promos de las clases de niñas.",
  },
  {
    id: "madres-crosssell",
    nombre: "Madres de ballet → Barre/Pilates",
    descripcion: "Madres de niñas que aún NO hacen nada de adultas. Objetivo madre + hija.",
  },
];

const NINAS_DISC = ["pre-ballet", "ballet-i", "ballet-ii"];
const norm = (e: unknown) => (typeof e === "string" ? e.trim().toLowerCase() : "");
const esEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export type Contacto = { email: string; nombre: string; fuente: string };

// Correos que reciben SIEMPRE cada campaña (control interno): no se excluyen por
// compra ni por baja, para poder ver el envío real tal como les llega.
const SIEMPRE_INCLUIDOS: Contacto[] = [
  { email: "gioacchinopalumbo38@gmail.com", nombre: "", fuente: "control" },
];

// Añade los correos de control al final de una lista ya limpia, sin duplicar.
function conControl(limpia: Contacto[]): Contacto[] {
  const ya = new Set(limpia.map((c) => c.email));
  return [...limpia, ...SIEMPRE_INCLUIDOS.filter((c) => !ya.has(c.email))];
}

/** Emails que NO pueden recibir marketing: ya compraron o se dieron de baja. */
async function excluidos(): Promise<Set<string>> {
  const [isc, bon, baj] = await Promise.all([
    supabaseAdmin.from("iscrizioni").select("email, stato"),
    supabaseAdmin.from("bonos").select("email"),
    supabaseAdmin.from("email_bajas").select("email"),
  ]);
  const fuera = new Set<string>();
  const PAGADAS = ["pagato", "pagado", "activa", "matricula_pagada"];
  for (const r of isc.data ?? []) {
    if (PAGADAS.includes(String(r.stato))) { const e = norm(r.email); if (e) fuera.add(e); }
  }
  for (const r of bon.data ?? []) { const e = norm(r.email); if (e) fuera.add(e); }
  for (const r of baj.data ?? []) { const e = norm(r.email); if (e) fuera.add(e); }
  return fuera;
}

/** Todas las interesadas, con su interés (niñas / adultas). */
async function interesadas(): Promise<{ adultas: Map<string, Contacto>; ninas: Map<string, Contacto> }> {
  const [jor, esp, paN, paA, isc] = await Promise.all([
    supabaseAdmin.from("reservas_jornada").select("email, nombre, nombre_madre, bloque"),
    supabaseAdmin.from("lista_espera_jornada").select("email, nombre"),
    supabaseAdmin.from("puertas_abiertas").select("email, nombre"),
    supabaseAdmin.from("puertas_abiertas_adultas").select("email, nombre"),
    supabaseAdmin.from("iscrizioni").select("email, nome, disciplina_id, stato"),
  ]);

  const adultas = new Map<string, Contacto>();
  const ninas = new Map<string, Contacto>();
  const add = (m: Map<string, Contacto>, email: string, nombre: string, fuente: string) => {
    const e = norm(email);
    if (!esEmail(e) || m.has(e)) return;
    m.set(e, { email: e, nombre: (nombre || "").trim(), fuente });
  };

  for (const r of jor.data ?? []) {
    // En turnos de niñas el contacto es la madre/padre, no la niña.
    if (r.bloque === "ninas") add(ninas, r.email as string, (r.nombre_madre as string) || (r.nombre as string), "jornada");
    else add(adultas, r.email as string, r.nombre as string, "jornada");
  }
  for (const r of esp.data ?? []) add(adultas, r.email as string, r.nombre as string, "lista de espera");
  for (const r of paN.data ?? []) add(ninas, r.email as string, r.nombre as string, "puertas abiertas");
  for (const r of paA.data ?? []) add(adultas, r.email as string, r.nombre as string, "puertas abiertas");
  for (const r of isc.data ?? []) {
    if (String(r.stato) !== "attesa") continue; // solo las que no llegaron a pagar
    const destino = NINAS_DISC.includes(String(r.disciplina_id)) ? ninas : adultas;
    add(destino, r.email as string, r.nome as string, "inscripción sin pagar");
  }
  return { adultas, ninas };
}

/** Contactos de un segmento, ya limpio de compradoras y bajas. */
export async function contactosDe(segmento: SegmentoId): Promise<Contacto[]> {
  const [{ adultas, ninas }, fuera] = await Promise.all([interesadas(), excluidos()]);
  let base: Contacto[];
  if (segmento === "adultas") base = [...adultas.values()];
  else if (segmento === "ninas") base = [...ninas.values()];
  else base = [...ninas.values()].filter(c => !adultas.has(c.email)); // madres que aún no hacen adultas
  const limpia = base.filter(c => !fuera.has(c.email)).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return conControl(limpia);
}

export async function resumenSegmentos() {
  const [{ adultas, ninas }, fuera] = await Promise.all([interesadas(), excluidos()]);
  const limpio = (l: Contacto[]) => conControl(l.filter(c => !fuera.has(c.email))).length;
  return {
    segmentos: SEGMENTOS.map(s => ({
      ...s,
      total:
        s.id === "adultas" ? limpio([...adultas.values()])
        : s.id === "ninas" ? limpio([...ninas.values()])
        : limpio([...ninas.values()].filter(c => !adultas.has(c.email))),
    })),
    excluidos: fuera.size,
  };
}

// ── Enlace de baja: token firmado, no hace falta guardarlo en la base ──
function secreto() {
  return process.env.ADMIN_SESSION_SECRET || process.env.RESEND_API_KEY || "acs";
}
export function tokenBaja(email: string): string {
  return crypto.createHmac("sha256", secreto()).update(norm(email)).digest("hex").slice(0, 32);
}
export function tokenValido(email: string, token: string): boolean {
  const esperado = tokenBaja(email);
  const a = Buffer.from(esperado);
  const b = Buffer.from((token || "").slice(0, 32).padEnd(32, "0"));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function enlaceBaja(email: string, base: string): string {
  return `${base}/baja?e=${encodeURIComponent(norm(email))}&t=${tokenBaja(email)}`;
}
