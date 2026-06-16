import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Guardia anti-duplicado: comprueba si este email ya tiene una inscripción
// PAGADA para la misma clase (disciplina + plan) en las últimas 48h. Sirve para
// avisar a la madre antes de cobrarle otra vez por error (no bloquea: solo avisa,
// porque apuntar a dos hijas a la misma clase el mismo día es legítimo).
// Service-role: iscrizioni está cerrada a la clave pública.

type Item = { disciplina_id: string; piano_id: string };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = (body?.email ?? "").toString().toLowerCase().trim();
  const items: Item[] = Array.isArray(body?.items) ? body.items : [];
  if (!email || items.length === 0) {
    return NextResponse.json({ duplicate: false });
  }

  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("iscrizioni")
    .select("disciplina_id, piano_id, discipline(nome)")
    .ilike("email", email)
    .in("stato", ["matricula_pagada", "activa", "pagato", "pagado"])
    .gte("created_at", since);

  // Ante cualquier error no bloqueamos la venta: devolvemos sin duplicado.
  if (error || !data) return NextResponse.json({ duplicate: false });

  const matches = data.filter((r) =>
    items.some((it) => it.disciplina_id === r.disciplina_id && it.piano_id === r.piano_id),
  );
  const disciplinas = Array.from(
    new Set(
      matches
        .map((m) => {
          const d = m.discipline as unknown as { nome: string } | { nome: string }[] | null;
          if (!d) return null;
          return Array.isArray(d) ? d[0]?.nome ?? null : d.nome;
        })
        .filter((n): n is string => !!n),
    ),
  );

  return NextResponse.json({ duplicate: matches.length > 0, disciplinas });
}
