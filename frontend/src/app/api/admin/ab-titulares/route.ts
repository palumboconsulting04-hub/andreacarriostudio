import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

// A/B de titulares de la landing de adultas: por cada variante (0,1,2) devuelve
// impresiones (visitas etiquetadas) y leads (formularios), para calcular la
// conversión de cada titular en el admin.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const N = 3;
  const impresiones: number[] = [];
  const leads: number[] = [];

  for (let v = 0; v < N; v++) {
    const { count: imp } = await supabaseAdmin
      .from("funnel_eventos")
      .select("id", { count: "exact", head: true })
      .eq("funnel", "adultas")
      .eq("step", "pa_visita")
      .eq("variante", v);
    impresiones.push(imp ?? 0);

    const { count: le } = await supabaseAdmin
      .from("puertas_abiertas_adultas")
      .select("id", { count: "exact", head: true })
      .eq("variante", v);
    leads.push(le ?? 0);
  }

  return NextResponse.json({ impresiones, leads });
}
