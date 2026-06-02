import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// Cierra la sesión del admin borrando la cookie. El middleware redirigirá al login.
export async function POST() {
  (await cookies()).delete("admin_session");
  return NextResponse.json({ ok: true });
}
