import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

const GRUPOS = new Set(["Pre-Ballet", "Ballet 1", "Ballet 2"]);
const ESTADO_CONTACTO = new Set(["sin_llamar", "no_contesta", "interesada", "se_lo_piensa", "no_renueva"]);
const ESTADO_PAGO = new Set(["pendiente", "pagado", "parcial"]);
const METODO_PAGO = new Set(["", "efectivo", "bizum", "web"]);

// Cada grupo de renovación corresponde a una disciplina real del catálogo.
// La alumna se asigna a TODAS las clases activas de su disciplina (cada grupo
// de niñas tiene 2 días fijos: p. ej. Ballet 1 = Martes y Jueves).
const GRUPO_A_DISCIPLINA: Record<string, string> = {
  "Pre-Ballet": "pre-ballet",
  "Ballet 1": "ballet-i",
  "Ballet 2": "ballet-ii",
};

type RenovacionDB = {
  id: string;
  nombre: string;
  apellidos: string | null;
  grupo: string;
  telefono: string | null;
  email: string | null;
  estado_pago: string;
  metodo_pago: string;
  iscrizione_id: string | null;
};

// Crea la inscripción "espejo" de una renovación pagada: una alumna real con sus
// horarios, para que aparezca en calendario, asistencia, usuarios y ocupación.
// La matrícula se pone a 0 porque el dinero ya se contabiliza desde la propia
// renovación (importe_matricula) y los pagos manuales — así no se duplica.
async function crearEspejo(renov: RenovacionDB): Promise<string | null> {
  const disciplina_id = GRUPO_A_DISCIPLINA[renov.grupo];
  if (!disciplina_id) return null;
  const { data: isc, error } = await supabaseAdmin
    .from("iscrizioni")
    .insert({
      nome: renov.nombre,
      cognome: renov.apellidos ?? "",
      nome_alumna: renov.nombre,
      cognome_alumna: renov.apellidos ?? "",
      email: renov.email || `renovacion-${renov.id}@andreacarriostudio.local`,
      telefono: renov.telefono,
      disciplina_id,
      piano_id: null,
      metodo_pagamento: renov.metodo_pago || "en-escuela",
      stato: "matricula_pagada",
      matricula: 0,
    })
    .select("id")
    .single();
  if (error || !isc) return null;
  // Asigna la alumna a todas las clases activas de su disciplina.
  const { data: orari } = await supabaseAdmin
    .from("orari")
    .select("id")
    .eq("disciplina_id", disciplina_id)
    .eq("attivo", true);
  if (orari && orari.length > 0) {
    await supabaseAdmin
      .from("iscrizione_orari")
      .insert(orari.map((o: { id: string }) => ({ iscrizione_id: isc.id, orario_id: o.id })));
  }
  return isc.id;
}

// Mantiene sincronizada la inscripción espejo según el estado de pago y el grupo.
// Pagada sin espejo → crea. No pagada con espejo → borra. Grupo cambiado → recrea.
async function sincronizarEspejo(renovId: string): Promise<void> {
  const { data: renov } = await supabaseAdmin
    .from("renovaciones")
    .select("id, nombre, apellidos, grupo, telefono, email, estado_pago, metodo_pago, iscrizione_id")
    .eq("id", renovId)
    .single();
  if (!renov) return;
  const r = renov as RenovacionDB;

  // Solo las pagadas en efectivo/bizum necesitan inscripción espejo. Las pagadas
  // por "web" ya tienen su inscripción real de Stripe (crear espejo las duplicaría
  // en calendario, asistencia y contabilidad).
  const debeTenerEspejo = r.estado_pago === "pagado" && r.metodo_pago !== "web";

  if (debeTenerEspejo) {
    if (r.iscrizione_id) {
      // Ya tiene espejo: comprobar que la disciplina coincide con el grupo actual.
      const { data: isc } = await supabaseAdmin
        .from("iscrizioni")
        .select("disciplina_id")
        .eq("id", r.iscrizione_id)
        .single();
      const esperada = GRUPO_A_DISCIPLINA[r.grupo];
      if (isc && isc.disciplina_id !== esperada) {
        // Cambió de grupo: borra el espejo viejo y crea uno nuevo.
        await supabaseAdmin.from("iscrizioni").delete().eq("id", r.iscrizione_id);
        const nuevoId = await crearEspejo(r);
        await supabaseAdmin.from("renovaciones").update({ iscrizione_id: nuevoId }).eq("id", r.id);
      }
    } else {
      const nuevoId = await crearEspejo(r);
      if (nuevoId) await supabaseAdmin.from("renovaciones").update({ iscrizione_id: nuevoId }).eq("id", r.id);
    }
  } else if (r.iscrizione_id) {
    // Ya no debe tener espejo (no pagada, o pagada por web): elimínala
    // (los horarios caen en cascada).
    await supabaseAdmin.from("iscrizioni").delete().eq("id", r.iscrizione_id);
    await supabaseAdmin.from("renovaciones").update({ iscrizione_id: null }).eq("id", r.id);
  }
}

// Lista las renovaciones del curso 2026-2027. Solo admin.
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("renovaciones")
    .select("*")
    .order("grupo", { ascending: true })
    .order("apellidos", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

// Crea una alumna manualmente (por si Andrea se olvidó de alguna). Solo admin.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const b = await req.json();
  if (!b?.nombre || !String(b.nombre).trim()) {
    return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
  }
  const grupo = GRUPOS.has(b.grupo) ? b.grupo : "Pre-Ballet";
  const row = {
    nombre: String(b.nombre).trim(),
    apellidos: b.apellidos ? String(b.apellidos).trim() : "",
    fecha_nacimiento: b.fecha_nacimiento || null,
    grupo,
    telefono: b.telefono ? String(b.telefono).trim() : null,
    email: b.email ? String(b.email).trim() : null,
    nota: b.nota ? String(b.nota).trim() : null,
  };
  const { data, error } = await supabaseAdmin.from("renovaciones").insert(row).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

// Actualiza una renovación: campos fijos (nombre, datos…) y/o seguimiento. Solo admin.
// Siempre refresca `updated_at`.
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  }
  const updates: Record<string, string | number | null> = { updated_at: new Date().toISOString() };

  // Campos fijos editables.
  if (body.nombre !== undefined) updates.nombre = String(body.nombre).trim();
  if (body.apellidos !== undefined) updates.apellidos = String(body.apellidos).trim();
  if (body.fecha_nacimiento !== undefined) updates.fecha_nacimiento = body.fecha_nacimiento || null;
  if (body.grupo !== undefined && GRUPOS.has(body.grupo)) updates.grupo = String(body.grupo);
  if (body.telefono !== undefined) updates.telefono = body.telefono ? String(body.telefono).trim() : null;
  if (body.email !== undefined) updates.email = body.email ? String(body.email).trim() : null;
  if (body.nota !== undefined) updates.nota = body.nota ? String(body.nota).trim() : null;
  // Seguimiento.
  if (body.estado_contacto !== undefined && ESTADO_CONTACTO.has(String(body.estado_contacto))) updates.estado_contacto = String(body.estado_contacto);
  if (body.estado_pago !== undefined && ESTADO_PAGO.has(String(body.estado_pago))) updates.estado_pago = String(body.estado_pago);
  if (body.metodo_pago !== undefined && METODO_PAGO.has(String(body.metodo_pago))) updates.metodo_pago = String(body.metodo_pago);
  if (body.notas !== undefined) updates.notas = String(body.notas);
  if (body.importe_matricula !== undefined) {
    const val = parseInt(String(body.importe_matricula), 10);
    if (!isNaN(val) && val >= 0) updates.importe_matricula = val;
  }

  const { error } = await supabaseAdmin.from("renovaciones").update(updates).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Si cambió el estado de pago, el grupo o el método de pago, sincroniza la
  // inscripción espejo (alta/baja en calendario, asistencia, clientas). No
  // bloquea la respuesta si falla.
  if (body.estado_pago !== undefined || body.grupo !== undefined || body.metodo_pago !== undefined) {
    try { await sincronizarEspejo(id); } catch { /* la actualización principal ya se guardó */ }
  }
  return NextResponse.json({ ok: true });
}

// Borra una alumna por id. Solo admin.
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  }
  // Borra antes la inscripción espejo, si la hubiera (sus horarios caen en cascada).
  const { data: renov } = await supabaseAdmin.from("renovaciones").select("iscrizione_id").eq("id", id).single();
  if (renov?.iscrizione_id) {
    await supabaseAdmin.from("iscrizioni").delete().eq("id", renov.iscrizione_id);
  }
  const { error } = await supabaseAdmin.from("renovaciones").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
