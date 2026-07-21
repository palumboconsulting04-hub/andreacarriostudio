import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

const INSCRITA = ["pagato", "pagado", "activa", "matricula_pagada"];
const NINAS = new Set(["pre-ballet", "ballet-i", "ballet-ii"]);

// GET → alumnas de mensualidad (con su cuota) + los meses ya pagados. Solo admin.
//   ?iscrizione_id=  → solo los pagos de esa alumna (para su ficha).
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const soloId = req.nextUrl.searchParams.get("iscrizione_id");
  if (soloId) {
    const { data } = await supabaseAdmin.from("cuotas").select("iscrizione_id, mes, metodo, origen").eq("iscrizione_id", soloId);
    const pagos = (data ?? []).map(c => ({ iscrizione_id: c.iscrizione_id as string, mes: (c.mes as string).slice(0, 7), metodo: (c.metodo as string) || "", origen: (c.origen as string) || "manual" }));
    return NextResponse.json({ pagos });
  }

  const [{ data: iscr }, { data: piani }, { data: cuotas }] = await Promise.all([
    supabaseAdmin.from("iscrizioni")
      .select("id, nome, cognome, nome_alumna, cognome_alumna, disciplina_id, piano_id, prezzo, discipline(nome)")
      .in("stato", INSCRITA),
    supabaseAdmin.from("piani").select("id, disciplina_id, prezzo"),
    supabaseAdmin.from("cuotas").select("iscrizione_id, mes, metodo, origen"),
  ]);

  const pm: Record<string, number> = {};
  for (const p of piani ?? []) pm[`${p.id}:${p.disciplina_id}`] = Number(p.prezzo) || 0;

  const alumnas = (iscr ?? []).map(i => {
    const nombre = NINAS.has(i.disciplina_id as string) && i.nome_alumna
      ? `${i.nome_alumna} ${i.cognome_alumna ?? ""}`.trim()
      : `${i.nome ?? ""} ${i.cognome ?? ""}`.trim();
    const cuota = (i.prezzo as number | null) ?? pm[`${i.piano_id}:${i.disciplina_id}`] ?? 0;
    const disc = (i.discipline as { nome?: string } | null)?.nome ?? (i.disciplina_id as string);
    return { id: i.id as string, nombre: nombre || "—", disciplina: disc, disciplina_id: i.disciplina_id as string, cuota };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre));

  const pagos = (cuotas ?? []).map(c => ({
    iscrizione_id: c.iscrizione_id as string,
    mes: (c.mes as string).slice(0, 7), // YYYY-MM
    metodo: (c.metodo as string) || "",
    origen: (c.origen as string) || "manual",
  }));

  return NextResponse.json({ alumnas, pagos });
}

// POST → marca un mes como pagado (a mano). { iscrizione_id, mes:"YYYY-MM", metodo, importe? }
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const iscrizione_id = (b?.iscrizione_id ?? "").toString();
  const mesRaw = (b?.mes ?? "").toString();
  if (!iscrizione_id || !/^\d{4}-\d{2}$/.test(mesRaw)) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  const mes = `${mesRaw}-01`;
  const metodo = (b?.metodo ?? "efectivo").toString();
  let importe = b?.importe != null && !Number.isNaN(Number(b.importe)) ? Number(b.importe) : null;

  // Si no viene el importe, lo calculamos de la cuota de la alumna (prezzo o plan).
  if (importe == null) {
    const { data: i } = await supabaseAdmin.from("iscrizioni").select("prezzo, piano_id, disciplina_id").eq("id", iscrizione_id).single();
    if (i) {
      importe = (i.prezzo as number | null) ?? null;
      if (importe == null) {
        const { data: p } = await supabaseAdmin.from("piani").select("prezzo").eq("id", i.piano_id).eq("disciplina_id", i.disciplina_id).maybeSingle();
        importe = p ? Number(p.prezzo) || 0 : 0;
      }
    }
  }

  const { error } = await supabaseAdmin.from("cuotas")
    .upsert({ iscrizione_id, mes, metodo, importe, origen: "manual" }, { onConflict: "iscrizione_id,mes" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE → desmarca un mes. ?iscrizione_id=&mes=YYYY-MM
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const iscrizione_id = sp.get("iscrizione_id") || "";
  const mesRaw = sp.get("mes") || "";
  if (!iscrizione_id || !/^\d{4}-\d{2}$/.test(mesRaw)) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  const { error } = await supabaseAdmin.from("cuotas").delete().eq("iscrizione_id", iscrizione_id).eq("mes", `${mesRaw}-01`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
