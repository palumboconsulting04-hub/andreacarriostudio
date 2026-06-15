import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Comprueba la cookie de sesión del admin (la misma que valida el middleware).
async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

// Lista las respuestas del cuestionario post-compra (profilo_marketing),
// unidas con la inscrita para mostrar a quién corresponde cada respuesta.
// Solo admin (service-role); estos datos no se exponen a la clave pública.
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("profilo_marketing")
    .select(
      "id, created_at, come_ci_hai_conosciuto, red_social, motivazione, fascia_eta, esperienza_previa, eta_figlia, esperienza_previa_figlia, obiettivo_figlia, iscrizioni(nome, cognome, nome_alumna, cognome_alumna, disciplina_id, discipline(nome))",
    )
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [] });
}
