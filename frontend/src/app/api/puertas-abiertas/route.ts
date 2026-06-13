import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, apellido, email, telefono, disciplina_adulta, ninas, alergias, origen, utm_source, utm_campaign, fbclid } = body;

    // El formulario corto de la landing solo pide nombre + teléfono (el contacto
    // con la madre es por WhatsApp). apellido/email son NOT NULL en la BD, así que
    // se guardan como cadena vacía cuando no se piden.
    if (!nombre || !telefono) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    // Datos base (siempre existen). La atribución de origen se guarda aparte
    // para poder degradar con elegancia si las columnas aún no se han creado.
    const baseRow = {
      nombre,
      apellido: apellido || "",
      email: email || "",
      telefono,
      disciplina_adulta: disciplina_adulta || null,
      ninas: ninas || [],
      alergias: alergias || null,
    };
    const atribRow = {
      origen: origen || "directo",
      utm_source: utm_source || null,
      utm_campaign: utm_campaign || null,
      fbclid: fbclid || null,
    };

    let { error } = await supabase.from("puertas_abiertas").insert({ ...baseRow, ...atribRow });

    // Si las columnas de atribución todavía no existen en la BD (PGRST204 /
    // "column not found"), reintentamos sin ellas para no perder la reserva.
    // En cuanto se creen las columnas, el origen se guardará automáticamente.
    if (error && (error.code === "PGRST204" || /column/i.test(error.message || ""))) {
      ({ error } = await supabase.from("puertas_abiertas").insert(baseRow));
    }

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
