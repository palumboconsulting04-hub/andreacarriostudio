import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

type EmbebidoBono = { nombre: string | null; email: string | null; telefono: string | null; disciplina_id: string | null };
type EmbebidoOrario = { giorno: string | null; ora_inizio: string | null; ora_fine: string | null };
type ReservaRow = {
  id: string; fecha: string; orario_id: string; bono_id: string;
  bonos: EmbebidoBono | EmbebidoBono[] | null;
  orari: EmbebidoOrario | EmbebidoOrario[] | null;
};
const uno = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

// Bonos vendidos + próximas reservas hechas con bono. Solo admin.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const hoy = new Date().toISOString().slice(0, 10);

  const [bonosRes, reservasRes] = await Promise.all([
    supabaseAdmin.from("bonos")
      .select("id, disciplina_id, nombre, email, telefono, creditos_totales, creditos_restantes, caduca, precio_pagado, estado, created_at, referido_por")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("reservas_clase")
      .select("id, fecha, orario_id, bono_id, bonos(nombre, email, telefono, disciplina_id), orari(giorno, ora_inizio, ora_fine)")
      .gte("fecha", hoy)
      .order("fecha", { ascending: true }),
  ]);

  if (bonosRes.error) return NextResponse.json({ error: bonosRes.error.message }, { status: 500 });

  const reservas = ((reservasRes.data ?? []) as ReservaRow[]).map((r) => {
    const b = uno(r.bonos);
    const o = uno(r.orari);
    return {
      id: r.id,
      fecha: r.fecha,
      dia: o?.giorno ?? "",
      hora: (o?.ora_inizio ?? "").slice(0, 5),
      horaFin: (o?.ora_fine ?? "").slice(0, 5),
      disciplina_id: b?.disciplina_id ?? "",
      alumna: b?.nombre ?? "",
      email: b?.email ?? "",
      telefono: b?.telefono ?? "",
    };
  });

  return NextResponse.json({ bonos: bonosRes.data ?? [], reservas });
}
