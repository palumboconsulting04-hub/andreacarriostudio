import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

const METODOS = new Set(["efectivo", "bizum", "otro"]);

// Lista los pagos manuales (efectivo/bizum). Opcional: ?renovacion_id=… para una alumna.
// Solo admin.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const renovacionId = req.nextUrl.searchParams.get("renovacion_id");
  let q = supabaseAdmin.from("pagos_manuales").select("*").order("fecha", { ascending: false });
  if (renovacionId) q = q.eq("renovacion_id", renovacionId);
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

// Registra un pago manual. Solo admin.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const b = await req.json();
  const importe = parseInt(String(b?.importe), 10);
  if (!b?.alumna_nombre || !String(b.alumna_nombre).trim()) {
    return NextResponse.json({ error: "Falta la alumna" }, { status: 400 });
  }
  if (isNaN(importe) || importe < 0) {
    return NextResponse.json({ error: "Importe no válido" }, { status: 400 });
  }
  const row = {
    renovacion_id: b.renovacion_id || null,
    alumna_nombre: String(b.alumna_nombre).trim(),
    concepto: b.concepto ? String(b.concepto).trim() : "Mensualidad",
    mes: b.mes ? String(b.mes).trim() : null,
    importe,
    metodo: METODOS.has(b.metodo) ? b.metodo : "efectivo",
    fecha: b.fecha || new Date().toLocaleDateString("en-CA"),
    notas: b.notas ? String(b.notas).trim() : null,
  };
  const { data, error } = await supabaseAdmin.from("pagos_manuales").insert(row).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

// Borra un pago manual por id. Solo admin.
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("pagos_manuales").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
