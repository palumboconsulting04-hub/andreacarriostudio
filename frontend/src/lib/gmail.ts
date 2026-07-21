// Helpers de OAuth de Gmail (solo lectura) mediante fetch, sin dependencias extra.
const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://reservas.andreacarriostudio.es";
export const GMAIL_REDIRECT = `${BASE}/api/admin/gmail/callback`;
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function gmailConfigurado(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export function authUrl(): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: GMAIL_REDIRECT,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export async function exchangeCode(code: string): Promise<{ refresh_token?: string; access_token?: string; error?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: GMAIL_REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  return res.json();
}

export async function accessFromRefresh(refresh_token: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      grant_type: "refresh_token",
    }),
  });
  const j = await res.json();
  return j.access_token ?? null;
}

export async function gmailFetch(token: string, path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
