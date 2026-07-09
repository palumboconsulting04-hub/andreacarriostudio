import { NextResponse } from "next/server";
import { cerrarSesion } from "@/lib/panel-auth";

export async function POST() {
  await cerrarSesion();
  return NextResponse.json({ ok: true });
}
