import type { Metadata } from "next";
import FooterLegal from "@/components/FooterLegal";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Landing de cierre de matrículas antes de vacaciones. Un solo enlace para
// todos los canales (grupo de WhatsApp, email, Instagram), corta y directa:
// un camino, prueba social real y urgencia por TIEMPO (las plazas sobran para
// septiembre; lo que aprieta es que el precio de 35€ acaba el 31 de julio).
// El horario se ve durante el proceso de reserva, así que aquí no va.

export const metadata: Metadata = {
  title: "Reserva tu plaza para septiembre — Andrea Carrió Studio",
  description:
    "Reserva tu plaza para septiembre antes de vacaciones: matrícula 35€ en vez de 50€ hasta el 31 de julio. Solo 12 personas por clase.",
};

export const revalidate = 300;

// En cuanto tengamos el número, se rellena aquí y la opción aparece sola.
const BIZUM = "";

const C = {
  burgundy: "#7d2b13",
  cream: "#fff8f5",
  blush: "#ffdbd1",
  soft: "#fff1e9",
  dark: "#25190f",
  brown: "#56423d",
  muted: "#89726c",
  border: "#dcc1b9",
};

const serif = "var(--font-playfair), 'Playfair Display', Georgia, serif";
const sans = "var(--font-montserrat), 'Montserrat', sans-serif";

function Cta({ children, href = "/", sub }: { children: React.ReactNode; href?: string; sub?: string }) {
  return (
    <a
      href={href}
      className="inline-flex flex-col items-center justify-center w-full py-4 px-8 rounded-full transition-opacity hover:opacity-90"
      style={{ backgroundColor: C.burgundy, color: C.cream, textDecoration: "none" }}
    >
      <span className="text-sm font-bold tracking-widest uppercase" style={{ fontFamily: sans }}>{children}</span>
      {sub && <span className="text-[11px] opacity-90 mt-0.5" style={{ fontFamily: sans }}>{sub}</span>}
    </a>
  );
}

export default async function ReservarPlazaPage() {
  const { count } = await supabaseAdmin
    .from("iscrizioni")
    .select("id", { count: "exact", head: true })
    .in("stato", ["pagato", "pagado", "activa", "matricula_pagada"]);
  const familias = count ?? 0;

  // Días que quedan con el precio de 35€ (hasta el 31 de julio incluido).
  const fin = new Date("2026-07-31T23:59:59");
  const dias = Math.max(0, Math.ceil((fin.getTime() - Date.now()) / 86400000));

  return (
    <div style={{ backgroundColor: C.cream, minHeight: "100vh" }}>
      {/* Barra de urgencia por tiempo (las plazas sobran; lo que acaba es el precio). */}
      {dias > 0 && (
        <div className="text-center py-2.5 px-4" style={{ backgroundColor: C.burgundy }}>
          <p className="text-xs sm:text-sm font-semibold" style={{ color: C.cream, fontFamily: sans }}>
            🎁 Matrícula 35€ (en vez de 50€) · solo {dias} día{dias !== 1 ? "s" : ""} más, hasta el 31 de julio
          </p>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-6 py-12 sm:py-16">

        {/* ── Hero ── */}
        <header className="text-center">
          <p className="text-xs tracking-[0.2em] uppercase font-semibold mb-5" style={{ color: C.burgundy, fontFamily: sans }}>
            Andrea Carrió Studio · Valencia
          </p>
          <h1 className="text-4xl sm:text-5xl leading-tight mb-5" style={{ fontFamily: serif, color: C.burgundy }}>
            Nos vamos de vacaciones.<br />¿Te guardamos la plaza?
          </h1>
          <p className="text-base sm:text-lg leading-relaxed mb-6" style={{ color: C.brown }}>
            Empezamos el <strong style={{ color: C.dark }}>martes 1 de septiembre</strong>. Reserva tu plaza con la
            matrícula y déjala lista para la vuelta — <strong style={{ color: C.dark }}>hoy 35€ en vez de 50€</strong>.
          </p>

          <div className="max-w-sm mx-auto">
            <Cta sub="Eliges tu horario al reservar">Reservar mi plaza · 35€</Cta>
          </div>

          {familias >= 5 && (
            <p className="text-sm mt-4" style={{ color: C.brown }}>
              🤎 <strong style={{ color: C.burgundy }}>{familias} familias</strong> ya han reservado su plaza para septiembre.
            </p>
          )}
          <p className="text-xs mt-2" style={{ color: C.muted }}>Solo 12 personas por clase · Sin compromiso, cancelas cuando quieras</p>
        </header>

        {/* ── Gancho madre + hija ── */}
        <div className="mt-10 rounded-2xl p-5 text-center" style={{ backgroundColor: C.blush }}>
          <p className="text-sm leading-relaxed" style={{ color: C.burgundy }}>
            🎁 <strong>¿Venís las dos?</strong> Apunta a tu hija y apúntate tú <strong>en la misma reserva</strong>,
            y con el código <strong>JUNTAS</strong> al pagar <strong>una matrícula es gratis</strong>.
          </p>
        </div>

        {/* ── Cómo pagar ── */}
        <section className="mt-14">
          <h2 className="text-2xl text-center mb-6" style={{ fontFamily: serif, color: C.burgundy }}>Cómo pagar</h2>
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl p-5 flex items-start gap-4" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
              <span className="text-2xl">💳</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm mb-0.5" style={{ color: C.dark, fontFamily: sans }}>Ahora, con tarjeta</p>
                <p className="text-sm" style={{ color: C.brown }}>Eliges tu horario y en dos minutos tu plaza queda reservada.</p>
              </div>
            </div>
            {BIZUM && (
              <div className="rounded-2xl p-5 flex items-start gap-4" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
                <span className="text-2xl">📱</span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm mb-0.5" style={{ color: C.dark, fontFamily: sans }}>Bizum</p>
                  <p className="text-sm" style={{ color: C.brown }}>Al <strong style={{ color: C.burgundy }}>{BIZUM}</strong> · pon el nombre y el horario que quieres en el concepto.</p>
                </div>
              </div>
            )}
            <div className="rounded-2xl p-5 flex items-start gap-4" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
              <span className="text-2xl">💵</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm mb-0.5" style={{ color: C.dark, fontFamily: sans }}>Mañana sábado, en efectivo</p>
                <p className="text-sm" style={{ color: C.brown }}>En el estudio, de <strong>9:00 a 13:00</strong>. Aunque esté dando clase, en recepción te atienden. C/ Motilla del Palancar 34 bajo.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Salida honesta: septiembre ── */}
        <section className="mt-14">
          <div className="rounded-3xl p-6" style={{ backgroundColor: C.soft, border: `1px solid ${C.border}` }}>
            <p className="text-sm leading-relaxed" style={{ color: C.brown }}>
              <strong style={{ color: C.burgundy }}>¿Aún no lo tienes claro?</strong> Sin problema: escríbeme en septiembre y miramos si queda hueco.
              Te lo digo con honestidad — las tardes de ballet niñas y el Barre por la tarde son las primeras en llenarse,
              así que no puedo prometerte sitio, pero si queda es tuyo.
            </p>
          </div>
        </section>

        {/* ── Cierre ── */}
        <section className="mt-12 text-center">
          <p className="text-base leading-relaxed mb-5" style={{ color: C.brown }}>
            Gracias por pasarte estos días — y si no pudiste venir, nos vemos en septiembre. 🤎
          </p>
          <p className="text-lg mb-7" style={{ fontFamily: serif, color: C.burgundy }}>Andrea</p>
          <div className="max-w-sm mx-auto">
            <Cta sub="El 1 de agosto vuelve a costar 50€">Reservar mi plaza · 35€</Cta>
          </div>
        </section>
      </main>

      <FooterLegal />
    </div>
  );
}
