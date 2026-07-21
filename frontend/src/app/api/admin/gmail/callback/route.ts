import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, accessFromRefresh, gmailFetch } from "@/lib/gmail";
import { supabaseAdmin } from "@/lib/supabase-admin";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://reservas.andreacarriostudio.es";

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

// GET ?code= → Google devuelve aquí tras dar permiso. Guarda el refresh token.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.redirect(`${BASE}/admin/login`);
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${BASE}/admin?gmail=error`);

  const tok = await exchangeCode(code);
  if (!tok.refresh_token) return NextResponse.redirect(`${BASE}/admin?gmail=error`);

  let email: string | null = null;
  try {
    const at = await accessFromRefresh(tok.refresh_token);
    if (at) { const prof = await gmailFetch(at, "profile"); email = (prof.emailAddress as string) ?? null; }
  } catch { /* el email es opcional */ }

  await supabaseAdmin.from("gmail_auth").upsert({ id: 1, refresh_token: tok.refresh_token, email, updated_at: new Date().toISOString() });
  return NextResponse.redirect(`${BASE}/admin?gmail=ok`);
}
