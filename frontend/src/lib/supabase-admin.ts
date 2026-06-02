import { createClient } from "@supabase/supabase-js";

// Cliente de SOLO servidor. Usa la service role key (secreta, nunca llega al
// navegador) y por tanto omite RLS. No importar nunca desde componentes cliente.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
