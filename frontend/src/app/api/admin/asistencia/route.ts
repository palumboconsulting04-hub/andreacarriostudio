import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Comprueba la cookie de sesión del admin (la misma que valida el middleware).
async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

// Estados que cuentan como alumna inscrita (tiene plaza en la clase).
const INSCRITA = ["pagato", "pagado", "activa", "matricula_pagada"];

type LinkRow = {
  iscrizione_id: string;
  iscrizioni: {
    id: string;
    nome: string;
    cognome: string;
    nome_alumna: string | null;
    cognome_alumna: string | null;
    disciplina_id: string;
    stato: string;
  } | null;
};

// GET
//  · ?orario_id=&fecha=  → roster de la clase con la marca de asistencia de ese día
//  · ?iscrizione_id=     → resumen de asistencia de una alumna
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const iscrizioneId = sp.get("iscrizione_id");

  // Resumen por alumna: % de asistencia y conteos.
  if (iscrizioneId) {
    const { data, error } = await supabaseAdmin
      .from("asistencia")
      .select("estado, fecha")
      .eq("iscrizione_id", iscrizioneId)
      .order("fecha", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const marcas = data ?? [];
    const presente = marcas.filter(m => m.estado === "presente").length;
    const falta = marcas.filter(m => m.estado === "falta").length;
    const justificada = marcas.filter(m => m.estado === "justificada").length;
    const total = marcas.length;
    // El % cuenta como "asistida" presente + justificada sobre el total de clases marcadas.
    const porcentaje = total > 0 ? Math.round(((presente + justificada) / total) * 100) : null;
    return NextResponse.json({ resumen: { presente, falta, justificada, total, porcentaje }, historial: marcas });
  }

  // Roster de una clase en una fecha.
  const orarioId = sp.get("orario_id");
  const fecha = sp.get("fecha");
  if (!orarioId || !fecha) {
    return NextResponse.json({ error: "Faltan orario_id y fecha" }, { status: 400 });
  }

  const [{ data: links, error: e1 }, { data: marks, error: e2 }] = await Promise.all([
    supabaseAdmin
      .from("iscrizione_orari")
      .select("iscrizione_id, iscrizioni(id, nome, cognome, nome_alumna, cognome_alumna, disciplina_id, stato)")
      .eq("orario_id", orarioId),
    supabaseAdmin
      .from("asistencia")
      .select("iscrizione_id, estado, nota")
      .eq("orario_id", orarioId)
      .eq("fecha", fecha),
  ]);
  if (e1 || e2) {
    return NextResponse.json({ error: (e1 ?? e2)?.message }, { status: 500 });
  }

  const markByIsc = new Map((marks ?? []).map(m => [m.iscrizione_id, m]));
  const alumnas = ((links ?? []) as unknown as LinkRow[])
    .filter(l => l.iscrizioni && INSCRITA.includes(l.iscrizioni.stato))
    .map(l => {
      const i = l.iscrizioni!;
      const esNina = ["pre-ballet", "ballet-i", "ballet-ii"].includes(i.disciplina_id);
      const nombre = esNina && i.nome_alumna
        ? `${i.nome_alumna} ${i.cognome_alumna ?? ""}`.trim()
        : `${i.nome} ${i.cognome}`;
      const mark = markByIsc.get(i.id);
      return { iscrizione_id: i.id, nombre, estado: mark?.estado ?? null, nota: mark?.nota ?? null };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return NextResponse.json({ alumnas });
}

// POST → registra/actualiza la marca de asistencia de una alumna en una clase y fecha.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json().catch(() => null) as
    | { iscrizione_id?: string; orario_id?: string; fecha?: string; estado?: string; nota?: string | null }
    | null;
  if (!body?.iscrizione_id || !body.orario_id || !body.fecha || !body.estado) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  if (!["presente", "falta", "justificada"].includes(body.estado)) {
    return NextResponse.json({ error: "Estado no válido" }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("asistencia")
    .upsert(
      {
        iscrizione_id: body.iscrizione_id,
        orario_id: body.orario_id,
        fecha: body.fecha,
        estado: body.estado,
        nota: body.nota ?? null,
      },
      { onConflict: "iscrizione_id,orario_id,fecha" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE → borra la marca (volver a "sin marcar"). ?iscrizione_id=&orario_id=&fecha=
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const iscrizioneId = sp.get("iscrizione_id");
  const orarioId = sp.get("orario_id");
  const fecha = sp.get("fecha");
  if (!iscrizioneId || !orarioId || !fecha) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("asistencia")
    .delete()
    .eq("iscrizione_id", iscrizioneId)
    .eq("orario_id", orarioId)
    .eq("fecha", fecha);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
