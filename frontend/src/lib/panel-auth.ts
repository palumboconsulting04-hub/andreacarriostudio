import crypto from "crypto";
import { cookies } from "next/headers";

// Auth sin contraseñas para el panel de la alumna. El enlace mágico y la sesión
// son tokens firmados con HMAC (base64url(payload).firma). El secreto es de
// servidor y nunca sale al cliente.
const SECRET = process.env.PANEL_SECRET || process.env.ADMIN_SESSION_SECRET || "";
const COOKIE = "panel_session";

function firmar(data: string): string {
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function crearToken(email: string, ttlSeg: number): string {
  const payload = Buffer.from(JSON.stringify({ e: email.toLowerCase().trim(), x: Date.now() + ttlSeg * 1000 })).toString("base64url");
  return `${payload}.${firmar(payload)}`;
}

export function leerToken(token: string | undefined | null): string | null {
  if (!token || !SECRET) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const esperado = firmar(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { e, x } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!e || !x || Date.now() > x) return null;
    return e as string;
  } catch {
    return null;
  }
}

// Sesión del panel: cookie httpOnly de 30 días.
export async function crearSesion(email: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE, crearToken(email, 30 * 24 * 3600), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 30 * 24 * 3600,
  });
}

export async function emailDeSesion(): Promise<string | null> {
  const c = await cookies();
  return leerToken(c.get(COOKIE)?.value);
}

export async function cerrarSesion(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
}
