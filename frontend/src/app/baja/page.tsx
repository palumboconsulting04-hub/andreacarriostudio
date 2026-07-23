import { supabaseAdmin } from "@/lib/supabase-admin";
import { tokenValido } from "@/lib/listas-email";

// Página de baja del email marketing. El enlace lleva un token firmado, así que
// nadie puede dar de baja a otra persona. Se ejecuta al abrir el enlace.

export const dynamic = "force-dynamic";

export default async function BajaPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string }>;
}) {
  const { e, t } = await searchParams;
  const email = (e ?? "").trim().toLowerCase();
  const ok = !!email && !!t && tokenValido(email, t);

  if (ok) {
    await supabaseAdmin.from("email_bajas").upsert({ email, origen: "enlace" }, { onConflict: "email" });
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5ede8", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: "24px", padding: "40px 32px", maxWidth: "460px", textAlign: "center", border: "1px solid #dcc1b9" }}>
        <p style={{ fontSize: "12px", letterSpacing: "2px", color: "#7d2b13", fontWeight: 700, margin: "0 0 20px" }}>
          ANDREA CARRIÓ STUDIO
        </p>
        {ok ? (
          <>
            <h1 style={{ fontSize: "24px", color: "#25190f", margin: "0 0 12px" }}>Listo, te he dado de baja</h1>
            <p style={{ color: "#56423d", lineHeight: 1.65, margin: 0 }}>
              No volverás a recibir correos con novedades ni promociones. Si algún día
              cambias de idea, escríbeme y te vuelvo a apuntar con mucho gusto.
            </p>
            <p style={{ color: "#89726c", fontSize: "13px", marginTop: "18px" }}>
              Seguirás recibiendo solo los correos importantes de tus clases o compras.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "24px", color: "#25190f", margin: "0 0 12px" }}>Enlace no válido</h1>
            <p style={{ color: "#56423d", lineHeight: 1.65, margin: 0 }}>
              Este enlace de baja no es correcto o ha caducado. Escríbeme y te doy de
              baja a mano enseguida.
            </p>
          </>
        )}
        <a href="https://andreacarriostudio.es" style={{ display: "inline-block", marginTop: "26px", color: "#7d2b13", fontSize: "14px" }}>
          andreacarriostudio.es
        </a>
      </div>
    </div>
  );
}
