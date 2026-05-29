import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, apellido, email, telefono, disciplina_adulta, ninas, alergias } = body;

    if (!nombre || !apellido || !email || !telefono) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    const { error } = await supabase.from("puertas_abiertas").insert({
      nombre,
      apellido,
      email,
      telefono,
      disciplina_adulta: disciplina_adulta || null,
      ninas: ninas || [],
      alergias: alergias || null,
    });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("puertas-abiertas error:", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
