import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { crearSesion } from "@/lib/panel-auth";

// Normaliza para comparar nombres: sin acentos, minúsculas, espacios colapsados.
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

// Login del panel: email + nombre. Solo entra si ese email tiene un bono activo
// y el nombre coincide con el de la compra.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = (body?.email ?? "").toString().trim().toLowerCase();
  const nombre = (body?.nombre ?? "").toString();
  if (!/\S+@\S+\.\S+/.test(email)) return NextResponse.json({ error: "Escribe un email válido." }, { status: 400 });
  if (!nombre.trim()) return NextResponse.json({ error: "Escribe tu nombre." }, { status: 400 });

  const hoy = new Date().toISOString().slice(0, 10);
  // Entra quien tiene un bono activo O una inscripción de mensualidad.
  const INSCRITA = ["pagato", "pagado", "activa", "matricula_pagada"];
  const [{ data: bonos }, { data: iscr }] = await Promise.all([
    supabaseAdmin.from("bonos").select("nombre").ilike("email", email).gt("creditos_restantes", 0).gte("caduca", hoy),
    supabaseAdmin.from("iscrizioni").select("nome, cognome").ilike("email", email).in("stato", INSCRITA),
  ]);

  const nombres = [
    ...(bonos ?? []).map((b) => norm(b.nombre as string)),
    ...(iscr ?? []).map((i) => norm(`${i.nome ?? ""} ${i.cognome ?? ""}`)),
    ...(iscr ?? []).map((i) => norm((i.nome ?? "") as string)),
  ].filter(Boolean);
  if (nombres.length === 0) {
    return NextResponse.json({ error: "No encontramos un bono ni una inscripción con ese correo. Usa el correo de tu compra o inscripción." }, { status: 401 });
  }

  const ne = norm(nombre);
  const coincide = nombres.some((nb) => nb === ne || nb.startsWith(ne + " ") || ne.startsWith(nb + " "));
  if (!coincide) {
    return NextResponse.json({ error: "El nombre no coincide con el de tu compra o inscripción." }, { status: 401 });
  }

  await crearSesion(email);
  return NextResponse.json({ ok: true });
}
