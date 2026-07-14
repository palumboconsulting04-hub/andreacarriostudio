import { supabaseAdmin } from "@/lib/supabase-admin";
import { crearToken } from "@/lib/panel-auth";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reservas.andreacarriostudio.es";

// Enlace mágico a /invita: abre el código de la alumna sin pedirle login (token
// firmado del email, válido 1 año). Para meterlo en los emails.
export function enlaceInvita(email: string): string {
  const em = (email || "").toLowerCase().trim();
  const t = crearToken(em, 365 * 24 * 3600);
  return `${APP_URL}/invita?email=${encodeURIComponent(em)}&t=${encodeURIComponent(t)}`;
}

// Código legible a partir del nombre: mayúsculas, sin acentos, solo letras.
function base(nombre: string): string {
  const sinAcentos = (nombre || "").split(" ")[0].normalize("NFD").replace(/[̀-ͯ]/g, "");
  const b = sinAcentos.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 12);
  return b || "AMIGA";
}

// Devuelve el código de madrina de un email; lo crea si no existe (idempotente).
export async function getCodigoReferido(email: string, nombre: string): Promise<string> {
  const em = (email || "").toLowerCase().trim();
  if (!em) return "";
  const { data: existe } = await supabaseAdmin
    .from("referidos_codigo").select("codigo").eq("email", em).maybeSingle();
  if (existe) return existe.codigo;

  const raiz = base(nombre);
  for (let i = 0; i < 30; i++) {
    const codigo = i === 0 ? raiz : `${raiz}${i + 1}`;
    const { error } = await supabaseAdmin.from("referidos_codigo").insert({ codigo, email: em, nombre });
    if (!error) return codigo;
    if (error.code === "23505") {
      // Choque: puede ser por email (otra ejecución a la vez) o por código.
      const { data: byEmail } = await supabaseAdmin
        .from("referidos_codigo").select("codigo").eq("email", em).maybeSingle();
      if (byEmail) return byEmail.codigo;
      continue; // choque de código → probamos el siguiente sufijo
    }
    throw error;
  }
  const codigo = raiz + Math.floor(1000 + Math.random() * 9000);
  await supabaseAdmin.from("referidos_codigo").insert({ codigo, email: em, nombre });
  return codigo;
}

// Resuelve un código a su email de madrina (para atribuir la compra). Null si no existe.
export async function emailDeCodigo(codigo: string): Promise<string | null> {
  const c = (codigo || "").trim().toUpperCase();
  if (!c) return null;
  const { data } = await supabaseAdmin
    .from("referidos_codigo").select("email").eq("codigo", c).maybeSingle();
  return data?.email ?? null;
}
