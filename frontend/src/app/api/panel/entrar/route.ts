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
  const { data } = await supabaseAdmin
    .from("bonos").select("nombre")
    .ilike("email", email).gt("creditos_restantes", 0).gte("caduca", hoy);

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "No encontramos un bono activo con ese correo. Usa el correo de la compra." }, { status: 401 });
  }

  const ne = norm(nombre);
  const coincide = data.some(b => {
    const nb = norm(b.nombre as string);
    return nb === ne || nb.startsWith(ne + " ") || ne.startsWith(nb + " ");
  });
  if (!coincide) {
    return NextResponse.json({ error: "El nombre no coincide con el de la compra." }, { status: 401 });
  }

  await crearSesion(email);
  return NextResponse.json({ ok: true });
}
