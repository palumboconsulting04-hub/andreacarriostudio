import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Persiste una inscripción del formulario público en el servidor (service-role),
// para que el navegador NO escriba en iscrizioni con la clave pública.
// Replica el comportamiento de getOrCreateContatto + submitIscrizione.

type InscripcionItem = {
  disciplina_id: string;
  piano_id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono?: string | null;
  metodo_pagamento: string;
  nome_alumna?: string | null;
  cognome_alumna?: string | null;
  matricula?: number;
  horarios?: string[];
};

type Body = {
  contatto: { nome: string; cognome: string; email: string; telefono?: string | null };
  existingContattoId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeCustomerId?: string | null;
  inscripciones: InscripcionItem[];
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.contatto?.email || !Array.isArray(body.inscripciones) || body.inscripciones.length === 0) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  // 1) Contacto: reutiliza el existente por email o créalo.
  let cId = body.existingContattoId ?? null;
  if (!cId) {
    const emailNorm = body.contatto.email.toLowerCase().trim();
    const { data: existing } = await supabaseAdmin
      .from("contatti")
      .select("id")
      .eq("email", emailNorm)
      .maybeSingle();
    if (existing) {
      cId = existing.id;
    } else {
      const { data: created, error: cErr } = await supabaseAdmin
        .from("contatti")
        .insert({
          nome: body.contatto.nome,
          cognome: body.contatto.cognome,
          email: emailNorm,
          telefono: body.contatto.telefono || null,
        })
        .select("id")
        .single();
      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
      cId = created.id;
    }
  }

  // 2) Una fila de iscrizioni por cada inscripción + sus horarios.
  let firstId = "";
  for (const item of body.inscripciones) {
    const { data: isc, error: iErr } = await supabaseAdmin
      .from("iscrizioni")
      .insert({
        contatto_id: cId,
        nome: item.nome,
        cognome: item.cognome,
        email: item.email,
        telefono: item.telefono || null,
        disciplina_id: item.disciplina_id,
        piano_id: item.piano_id,
        metodo_pagamento: item.metodo_pagamento,
        stato: "attesa",
        nome_alumna: item.nome_alumna || null,
        cognome_alumna: item.cognome_alumna || null,
        matricula: item.matricula ?? 0,
        stripe_payment_intent_id: body.stripePaymentIntentId || null,
        stripe_customer_id: body.stripeCustomerId || null,
      })
      .select("id")
      .single();
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

    if (item.horarios && item.horarios.length > 0) {
      const { error: oErr } = await supabaseAdmin
        .from("iscrizione_orari")
        .insert(item.horarios.map((orario_id) => ({ iscrizione_id: isc.id, orario_id })));
      if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });
    }
    if (!firstId) firstId = isc.id;
  }

  return NextResponse.json({ cId, firstId });
}
