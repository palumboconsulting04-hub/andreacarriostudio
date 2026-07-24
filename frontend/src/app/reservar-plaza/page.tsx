import type { Metadata } from "next";
import FooterLegal from "@/components/FooterLegal";

// Landing de cierre de matrículas antes de vacaciones. Un solo enlace para
// todos los canales (grupo de WhatsApp, email, Instagram): el hero es común y
// justo debajo cada una elige si la plaza es para su hija o para ella.

export const metadata: Metadata = {
  title: "Reserva tu plaza para septiembre — Andrea Carrió Studio",
  description:
    "Los grupos se cierran ahora. Con la matrícula reservo tu plaza para septiembre: 35€ en vez de 50€ hasta el 31 de julio. Solo 12 personas por clase.",
};

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

function Cta({ children, href = "/" }: { children: React.ReactNode; href?: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center w-full py-4 px-8 rounded-full text-sm font-bold tracking-widest uppercase transition-opacity hover:opacity-90"
      style={{ backgroundColor: C.burgundy, color: C.cream, fontFamily: sans, textDecoration: "none" }}
    >
      {children}
    </a>
  );
}

export default function ReservarPlazaPage() {
  return (
    <div style={{ backgroundColor: C.cream, minHeight: "100vh" }}>
      <main className="max-w-2xl mx-auto px-6 py-14 sm:py-20">

        {/* ── Hero ── */}
        <header className="text-center">
          <p className="text-xs tracking-[0.2em] uppercase font-semibold mb-5" style={{ color: C.burgundy, fontFamily: sans }}>
            Andrea Carrió Studio · Valencia
          </p>
          <h1 className="text-4xl sm:text-5xl leading-tight mb-5" style={{ fontFamily: serif, color: C.burgundy }}>
            Me voy de vacaciones.<br />¿Te guardo la plaza?
          </h1>
          <p className="text-base sm:text-lg leading-relaxed mb-7" style={{ color: C.brown }}>
            En septiembre empezamos, pero <strong style={{ color: C.dark }}>los grupos los cierro ahora</strong>.
            Con la matrícula reservo el sitio — y hasta el <strong style={{ color: C.dark }}>31 de julio son 35€ en vez de 50€</strong>.
          </p>

          <div className="rounded-2xl px-5 py-4 mb-7 inline-flex items-baseline gap-3" style={{ backgroundColor: C.blush }}>
            <span className="text-3xl font-bold" style={{ color: C.burgundy, fontFamily: serif }}>35€</span>
            <span className="text-lg line-through" style={{ color: C.muted }}>50€</span>
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.burgundy }}>hasta el 31 de julio</span>
          </div>

          <Cta>Reservar la plaza · 35€</Cta>

          <p className="text-xs mt-4" style={{ color: C.muted }}>
            Solo 12 personas por clase · Las clases empiezan en septiembre
          </p>
        </header>

        {/* ── Bifurcación: cada una se reconoce en dos segundos ── */}
        <section className="mt-16">
          <h2 className="text-2xl text-center mb-7" style={{ fontFamily: serif, color: C.burgundy }}>
            ¿Para quién es la plaza?
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl p-6 flex flex-col" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
              <p className="text-3xl mb-2">🩰</p>
              <p className="text-xl font-semibold mb-1" style={{ fontFamily: serif, color: C.burgundy }}>Para mi hija</p>
              <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: C.muted, fontFamily: sans }}>Ballet</p>
              <p className="text-sm leading-relaxed flex-1 mb-5" style={{ color: C.brown }}>
                Pre-Ballet (3–6), Ballet I (7–9) y Ballet II (10–14).
                Solo <strong>12 niñas por clase</strong>: es lo que me permite corregir a cada una.
              </p>
              <Cta>Reservar su plaza</Cta>
            </div>

            <div className="rounded-3xl p-6 flex flex-col" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
              <p className="text-3xl mb-2">💪</p>
              <p className="text-xl font-semibold mb-1" style={{ fontFamily: serif, color: C.burgundy }}>Para mí</p>
              <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: C.muted, fontFamily: sans }}>Barre y Pilates</p>
              <p className="text-sm leading-relaxed flex-1 mb-5" style={{ color: C.brown }}>
                Barre Fit y Pilates Mat, mañanas y tardes.
                Grupos de <strong>12</strong> para poder estar pendiente de ti de verdad.
              </p>
              <Cta>Reservar mi plaza</Cta>
            </div>
          </div>
        </section>

        {/* ── Cómo pagar ── */}
        <section className="mt-16">
          <h2 className="text-2xl text-center mb-7" style={{ fontFamily: serif, color: C.burgundy }}>
            Cómo pagar — lo que te venga mejor
          </h2>

          <div className="flex flex-col gap-3">
            <div className="rounded-2xl p-5 flex items-start gap-4" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
              <span className="text-2xl">💳</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm mb-0.5" style={{ color: C.dark, fontFamily: sans }}>Ahora, con tarjeta</p>
                <p className="text-sm" style={{ color: C.brown }}>Dos minutos y tu plaza queda reservada. <a href="/" style={{ color: C.burgundy, fontWeight: 600 }}>Reservar →</a></p>
              </div>
            </div>

            {BIZUM && (
              <div className="rounded-2xl p-5 flex items-start gap-4" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
                <span className="text-2xl">📱</span>
                <div className="min-w-0">
                  <p className="font-semibold text-sm mb-0.5" style={{ color: C.dark, fontFamily: sans }}>Bizum</p>
                  <p className="text-sm" style={{ color: C.brown }}>
                    Al <strong style={{ color: C.burgundy }}>{BIZUM}</strong> · pon el nombre en el concepto y te confirmo la plaza.
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-2xl p-5 flex items-start gap-4" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
              <span className="text-2xl">💵</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm mb-0.5" style={{ color: C.dark, fontFamily: sans }}>Mañana, en efectivo</p>
                <p className="text-sm" style={{ color: C.brown }}>En el estudio, de <strong>9:00 a 13:00</strong>. C/ Motilla del Palancar 34 bajo.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── La salida honesta: septiembre ── */}
        <section className="mt-16">
          <div className="rounded-3xl p-7" style={{ backgroundColor: C.soft, border: `1px solid ${C.border}` }}>
            <h2 className="text-xl mb-3" style={{ fontFamily: serif, color: C.burgundy }}>
              ¿Todavía no lo tienes claro?
            </h2>
            <p className="text-sm leading-relaxed mb-3" style={{ color: C.brown }}>
              Tranquila, de verdad. Si prefieres decidirlo con calma, <strong>escríbeme en septiembre</strong> y miramos si queda hueco.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: C.brown }}>
              Te lo digo con honestidad: las tardes de ballet y las horas de mañana de Barre son las primeras
              en llenarse, así que <strong style={{ color: C.dark }}>no puedo prometerte sitio</strong>. Pero si queda, es tuyo.
            </p>
          </div>
        </section>

        {/* ── Cierre ── */}
        <section className="mt-14 text-center">
          <p className="text-base leading-relaxed mb-6" style={{ color: C.brown }}>
            Gracias por pasarte estos días — y si no pudiste venir, nos vemos en septiembre. 🤎
          </p>
          <p className="text-lg mb-8" style={{ fontFamily: serif, color: C.burgundy }}>Andrea</p>
          <Cta>Reservar mi plaza · 35€</Cta>
          <p className="text-xs mt-4" style={{ color: C.muted }}>
            La matrícula reserva tu sitio. El 1 de agosto vuelve a costar 50€.
          </p>
        </section>
      </main>

      <FooterLegal />
    </div>
  );
}
