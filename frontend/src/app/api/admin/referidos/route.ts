import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

type Amiga = { nombre: string; email: string; via: "bono" | "mensualidad"; fecha: string; estado: string };
type Premio = { tipo: string; detalle: string; importeCent: number | null; fecha: string };
type Madrina = {
  codigo: string; nombre: string; email: string;
  amigas: Amiga[]; total: number;
  amigasMensualidad: number; tieneMensualidad: boolean;
  premios: Premio[];
};

// Programa "Trae a tu amiga": por cada madrina (referidos_codigo), las amigas que
// han comprado con su código, sea un bono (bonos.referido_por) o una mensualidad
// (iscrizioni.referido_por), más qué premios se le han otorgado ya. Solo lectura, solo admin.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [codigosRes, bonosRes, iscrRes, mensualRes, premiosRes] = await Promise.all([
    supabaseAdmin.from("referidos_codigo").select("codigo, email, nombre"),
    supabaseAdmin.from("bonos")
      .select("nombre, email, referido_por, created_at, estado, precio_pagado")
      .not("referido_por", "is", null),
    supabaseAdmin.from("iscrizioni")
      .select("nome, cognome, email, referido_por, created_at, stato")
      .not("referido_por", "is", null),
    // Madrinas que pagan mensualidad (tienen suscripción/cliente en Stripe).
    supabaseAdmin.from("iscrizioni")
      .select("email, stripe_customer_id")
      .not("stripe_customer_id", "is", null),
    supabaseAdmin.from("premios_referido")
      .select("madrina_codigo, tipo, detalle, importe_cent, created_at"),
  ]);
  if (codigosRes.error) return NextResponse.json({ error: codigosRes.error.message }, { status: 500 });

  // Emails que tienen una mensualidad activa en Stripe.
  const emailsMensualidad = new Set<string>();
  for (const r of mensualRes.data ?? []) if (r.email) emailsMensualidad.add(r.email.toLowerCase());

  // Premios ya otorgados por código.
  const premiosPorCodigo = new Map<string, Premio[]>();
  for (const p of premiosRes.data ?? []) {
    const arr = premiosPorCodigo.get(p.madrina_codigo) ?? [];
    arr.push({ tipo: p.tipo, detalle: p.detalle ?? "", importeCent: p.importe_cent ?? null, fecha: (p.created_at ?? "").slice(0, 10) });
    premiosPorCodigo.set(p.madrina_codigo, arr);
  }

  // Índice de madrinas por código.
  const porCodigo = new Map<string, Madrina>();
  for (const c of codigosRes.data ?? []) {
    porCodigo.set(c.codigo, {
      codigo: c.codigo, nombre: c.nombre ?? "", email: c.email ?? "",
      amigas: [], total: 0, amigasMensualidad: 0,
      tieneMensualidad: emailsMensualidad.has((c.email ?? "").toLowerCase()),
      premios: premiosPorCodigo.get(c.codigo) ?? [],
    });
  }

  // Añade una amiga a su madrina, sin duplicar por email (una amiga cuenta una vez).
  const vistas = new Map<string, Set<string>>(); // codigo -> set(email)
  const add = (codigo: string, a: Amiga) => {
    const m = porCodigo.get(codigo);
    if (!m) return; // código huérfano (no debería pasar)
    const email = a.email.toLowerCase();
    let set = vistas.get(codigo);
    if (!set) { set = new Set(); vistas.set(codigo, set); }
    if (email && set.has(email)) return;
    if (email) set.add(email);
    m.amigas.push(a);
  };

  for (const b of bonosRes.data ?? []) {
    if (!b.referido_por) continue;
    add(b.referido_por, {
      nombre: b.nombre ?? "", email: (b.email ?? "").toLowerCase(),
      via: "bono", fecha: (b.created_at ?? "").slice(0, 10), estado: b.estado ?? "",
    });
  }
  for (const i of iscrRes.data ?? []) {
    if (!i.referido_por) continue;
    add(i.referido_por, {
      nombre: `${i.nome ?? ""} ${i.cognome ?? ""}`.trim(), email: (i.email ?? "").toLowerCase(),
      via: "mensualidad", fecha: (i.created_at ?? "").slice(0, 10), estado: i.stato ?? "",
    });
  }

  const madrinas = [...porCodigo.values()]
    .map((m) => ({ ...m, total: m.amigas.length, amigasMensualidad: m.amigas.filter((a) => a.via === "mensualidad").length }))
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total);

  // Cifras de negocio del canal: ingresos por bonos referidos y premios pagados (€).
  const ingresosBonos = (bonosRes.data ?? []).reduce((s, b) => s + (Number(b.precio_pagado) || 0), 0);
  const premiosPagados = (premiosRes.data ?? []).reduce((s, p) => s + (Number(p.importe_cent) || 0), 0) / 100;
  const amigasBono = madrinas.reduce((s, m) => s + m.amigas.filter((a) => a.via === "bono").length, 0);
  const amigasMensualidad = madrinas.reduce((s, m) => s + m.amigas.filter((a) => a.via === "mensualidad").length, 0);

  const resumen = {
    codigosEmitidos: (codigosRes.data ?? []).length,
    amigasTraidas: madrinas.reduce((s, m) => s + m.total, 0),
    amigasBono,
    amigasMensualidad,
    madrinasActivas: madrinas.length,
    embajadoras: madrinas.filter((m) => m.total >= 5).length,
    ingresosBonos,
    premiosPagados,
  };

  return NextResponse.json({ madrinas, resumen });
}
