import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDeSesion } from "@/lib/panel-auth";

const INSCRITA = ["pagato", "pagado", "activa", "matricula_pagada"];
const pad = (n: number) => String(n).padStart(2, "0");
const horaMin = (t: string) => { const [h, m] = t.split(":"); return (+h) * 60 + (+m); };

// La alumna de mensualidad avisa (o deshace el aviso) de que un día no puede ir a una
// de sus clases fijas. Puede hasta que la clase empieza. Motivo opcional. No elige nada.
export async function POST(req: NextRequest) {
  const email = await emailDeSesion();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { iscrizione_id?: string; orario_id?: string; fecha?: string; motivo?: string | null; cancelar?: boolean }
    | null;
  const iscrizioneId = (body?.iscrizione_id ?? "").toString();
  const orarioId = (body?.orario_id ?? "").toString();
  const fecha = (body?.fecha ?? "").toString();
  if (!iscrizioneId || !orarioId || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  // La inscripción debe ser de esta alumna e incluir ese horario.
  const { data: isc } = await supabaseAdmin
    .from("iscrizioni").select("email, stato").eq("id", iscrizioneId).maybeSingle();
  if (!isc || (isc.email ?? "").toLowerCase() !== email.toLowerCase() || !INSCRITA.includes(isc.stato ?? "")) {
    return NextResponse.json({ error: "No es tu clase." }, { status: 403 });
  }
  const { data: link } = await supabaseAdmin
    .from("iscrizione_orari").select("orario_id").eq("iscrizione_id", iscrizioneId).eq("orario_id", orarioId).maybeSingle();
  if (!link) return NextResponse.json({ error: "No es tu clase." }, { status: 403 });

  // Deshacer el aviso → borra la marca (vuelve a ir).
  if (body?.cancelar) {
    await supabaseAdmin.from("asistencia").delete()
      .eq("iscrizione_id", iscrizioneId).eq("orario_id", orarioId).eq("fecha", fecha).eq("estado", "no_viene");
    return NextResponse.json({ ok: true, avisado: false });
  }

  // Solo hasta que la clase empieza (hora de Madrid).
  const { data: o } = await supabaseAdmin.from("orari").select("ora_inizio").eq("id", orarioId).maybeSingle();
  const nowMadrid = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  const todayMadrid = `${nowMadrid.getFullYear()}-${pad(nowMadrid.getMonth() + 1)}-${pad(nowMadrid.getDate())}`;
  const nowMin = nowMadrid.getHours() * 60 + nowMadrid.getMinutes();
  const empezada = fecha < todayMadrid || (fecha === todayMadrid && horaMin((o?.ora_inizio ?? "00:00:00").slice(0, 5)) <= nowMin);
  if (empezada) return NextResponse.json({ error: "Esa clase ya ha empezado." }, { status: 409 });

  const motivo = (body?.motivo ?? "").toString().trim().slice(0, 300) || null;
  const { error } = await supabaseAdmin.from("asistencia")
    .upsert({ iscrizione_id: iscrizioneId, orario_id: orarioId, fecha, estado: "no_viene", nota: motivo }, { onConflict: "iscrizione_id,orario_id,fecha" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, avisado: true });
}
