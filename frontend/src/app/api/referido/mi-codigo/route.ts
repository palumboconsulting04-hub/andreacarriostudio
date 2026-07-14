import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCodigoReferido } from "@/lib/referidos";
import { leerToken } from "@/lib/panel-auth";

// Normaliza para comparar nombres: sin acentos, minúsculas, espacios colapsados.
const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

// Devuelve a una alumna (bono o mensualidad) su código de madrina y su progreso.
// Autentica por token del enlace mágico (email firmado) o, si no, por email + nombre
// contra sus inscripciones/bonos (sin exigir bono activo).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = (body?.email ?? "").toString().trim().toLowerCase();
  const nombre = (body?.nombre ?? "").toString();
  const token = (body?.token ?? "").toString();
  if (!/\S+@\S+\.\S+/.test(email)) return NextResponse.json({ error: "Escribe un email válido." }, { status: 400 });

  const [iscrRes, bonosRes] = await Promise.all([
    supabaseAdmin.from("iscrizioni").select("nome, cognome").ilike("email", email),
    supabaseAdmin.from("bonos").select("nombre").ilike("email", email),
  ]);
  const iscr = iscrRes.data ?? [];
  const bonos = bonosRes.data ?? [];

  // Autenticación por token (enlace mágico del email) → directo, sin nombre.
  const emailTok = token ? leerToken(token) : null;
  const porToken = !!emailTok && emailTok.toLowerCase() === email;

  if (!porToken) {
    if (!nombre.trim()) return NextResponse.json({ error: "Escribe tu nombre." }, { status: 400 });
    if (iscr.length === 0 && bonos.length === 0) {
      return NextResponse.json({ error: "No encontramos a nadie con ese correo. Usa el correo de tu inscripción o de tu bono." }, { status: 404 });
    }
    // El nombre debe coincidir con el de alguna inscripción o bono.
    const ne = norm(nombre);
    const candidatos = [
      ...bonos.map((b) => norm(b.nombre as string)),
      ...iscr.map((i) => norm(`${i.nome ?? ""} ${i.cognome ?? ""}`)),
      ...iscr.map((i) => norm(i.nome ?? "")),
    ].filter(Boolean);
    const coincide = candidatos.some((nb) => nb === ne || nb.startsWith(ne + " ") || ne.startsWith(nb + " "));
    if (!coincide) return NextResponse.json({ error: "El nombre no coincide con el de tu inscripción." }, { status: 401 });
  }

  // Nombre para el código (el de su ficha, no el que escribió).
  const nombrePersona = (iscr[0]?.nome as string) || (bonos[0]?.nombre as string) || nombre;
  const codigo = await getCodigoReferido(email, nombrePersona);

  // Progreso: amigas traídas (dedup por email) + premios ganados.
  const [aBono, aIscr, premiosRes] = await Promise.all([
    supabaseAdmin.from("bonos").select("email").eq("referido_por", codigo),
    supabaseAdmin.from("iscrizioni").select("email").eq("referido_por", codigo),
    supabaseAdmin.from("premios_referido").select("detalle, created_at").eq("madrina_codigo", codigo).neq("tipo", "aviso_embajadora").order("created_at", { ascending: false }),
  ]);
  const totalAmigas = new Set([
    ...(aBono.data ?? []).map((r) => (r.email ?? "").toLowerCase()),
    ...(aIscr.data ?? []).map((r) => (r.email ?? "").toLowerCase()),
  ].filter(Boolean)).size;
  const premios = (premiosRes.data ?? []).map((p) => ({ detalle: p.detalle ?? "", fecha: (p.created_at ?? "").slice(0, 10) }));

  return NextResponse.json({ codigo, nombre: nombrePersona, totalAmigas, premios });
}
