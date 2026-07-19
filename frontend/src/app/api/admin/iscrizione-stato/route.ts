import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Comprueba la cookie de sesión del admin (la misma que valida el middleware).
async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

const ESTADOS = ["attesa", "pagato", "pagado", "activa", "matricula_pagada", "impago", "cancelada"];

// PATCH → cambia el estado de una inscripción. Solo admin (service-role).
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const b = await req.json().catch(() => null) as { id?: string; stato?: string; metodo_pagamento?: string } | null;
  if (!b?.id || !b.stato) {
    return NextResponse.json({ error: "Faltan id y estado" }, { status: 400 });
  }
  if (!ESTADOS.includes(b.stato)) {
    return NextResponse.json({ error: "Estado no válido" }, { status: 400 });
  }
  // Opcional: al marcar pagada una alta manual, guardamos también cómo pagó.
  const patch: { stato: string; metodo_pagamento?: string } = { stato: b.stato };
  if (typeof b.metodo_pagamento === "string" && b.metodo_pagamento) patch.metodo_pagamento = b.metodo_pagamento;
  const { error } = await supabaseAdmin.from("iscrizioni").update(patch).eq("id", b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
