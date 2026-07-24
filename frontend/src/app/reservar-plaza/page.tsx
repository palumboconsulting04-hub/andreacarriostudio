import type { Metadata } from "next";
import FooterLegal from "@/components/FooterLegal";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Landing de cierre de matrículas antes de vacaciones. Un solo enlace para
// todos los canales (grupo de WhatsApp, email, Instagram): un camino claro,
// horario en desplegable (para no frenar el impulso), prueba social real y
// urgencia por TIEMPO (las plazas sobran para septiembre; lo que aprieta es
// que el precio de 35€ acaba el 31 de julio).

export const metadata: Metadata = {
  title: "Reserva tu plaza para septiembre — Andrea Carrió Studio",
  description:
    "Los grupos se cierran ahora. Con la matrícula reservo tu plaza para septiembre: 35€ en vez de 50€ hasta el 31 de julio. Solo 12 personas por clase.",
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

const ORDEN_DISC = ["pre-ballet", "ballet-i", "ballet-ii", "barre-fit", "pilates-mat"];
const ORDEN_DIA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const NINAS = new Set(["pre-ballet", "ballet-i", "ballet-ii"]);

type Fila = { disciplina_id: string; giorno: string; ora_inizio: string; ora_fine: string; discipline: { nome: string } | null };

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

function agrupar(filas: Fila[]) {
  const porDia = new Map<string, string[]>();
  for (const f of filas) porDia.set(f.giorno, [...(porDia.get(f.giorno) ?? []), f.ora_inizio.slice(0, 5)]);
  return [...porDia.entries()].sort((a, b) => ORDEN_DIA.indexOf(a[0]) - ORDEN_DIA.indexOf(b[0]));
}

function Horario({ nombre, filas }: { nombre: string; filas: Fila[] }) {
  const dias = agrupar(filas);
  const rangos = new Set(filas.map(f => `${f.ora_inizio.slice(0, 5)}–${f.ora_fine.slice(0, 5)}`));
  const mismaHora = rangos.size === 1;
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
      <p className="font-semibold text-sm mb-1.5" style={{ color: C.burgundy, fontFamily: serif }}>{nombre}</p>
      {mismaHora ? (
        <p className="text-sm" style={{ color: C.brown }}>
          <strong style={{ color: C.dark }}>{dias.map(([d]) => d).join(" y ")}</strong> · {[...rangos][0]}
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {dias.map(([dia, horas]) => (
            <p key={dia} className="text-sm" style={{ color: C.brown }}>
              <strong style={{ color: C.dark }}>{dia}</strong> · {horas.join("  ·  ")}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function ReservarPlazaPage() {
  const [orariRes, countRes] = await Promise.all([
    supabaseAdmin.from("orari").select("disciplina_id, giorno, ora_inizio, ora_fine, discipline(nome)").eq("attivo", true).order("ora_inizio"),
    supabaseAdmin.from("iscrizioni").select("id", { count: "exact", head: true }).in("stato", ["pagato", "pagado", "activa", "matricula_pagada"]),
  ]);
  const filas = (orariRes.data ?? []) as unknown as Fila[];
  const familias = countRes.count ?? 0;

  const porDisc = new Map<string, Fila[]>();
  for (const f of filas) porDisc.set(f.disciplina_id, [...(porDisc.get(f.disciplina_id) ?? []), f]);
  const ordenadas = ORDEN_DISC.filter(id => porDisc.has(id)).map(id => ({ id, nombre: porDisc.get(id)![0].discipline?.nome ?? id, filas: porDisc.get(id)! }));
  const ninas = ordenadas.filter(d => NINAS.has(d.id));
  const adultas = ordenadas.filter(d => !NINAS.has(d.id));

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
            Me voy de vacaciones.<br />¿Te guardo la plaza?
          </h1>
          <p className="text-base sm:text-lg leading-relaxed mb-6" style={{ color: C.brown }}>
            Empezamos el <strong style={{ color: C.dark }}>martes 1 de septiembre</strong>, pero los grupos los cierro ahora.
            Con la matrícula te reservo el sitio — <strong style={{ color: C.dark }}>hoy 35€ en vez de 50€</strong>.
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

        {/* ── Horario en desplegable: no frena a quien ya sabe que le encaja ── */}
        <details className="mt-10 rounded-2xl" style={{ border: `1px solid ${C.border}`, backgroundColor: "#fff" }}>
          <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold flex items-center justify-between" style={{ color: C.burgundy, fontFamily: sans, listStyle: "none" }}>
            <span>📅 Ver los horarios del curso</span>
            <span style={{ color: C.muted }}>abrir</span>
          </summary>
          <div className="px-5 pb-5 pt-1 space-y-4">
            <p className="text-xs" style={{ color: C.muted }}>Empezamos el martes 1 de septiembre. Eliges tu día y hora al reservar.</p>
            {ninas.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: C.burgundy, fontFamily: sans }}>🩰 Ballet · niñas</p>
                <div className="flex flex-col gap-2">{ninas.map(d => <Horario key={d.id} nombre={d.nombre} filas={d.filas} />)}</div>
              </div>
            )}
            {adultas.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: C.burgundy, fontFamily: sans }}>💪 Adultas · Barre y Pilates</p>
                <div className="flex flex-col gap-2">{adultas.map(d => <Horario key={d.id} nombre={d.nombre} filas={d.filas} />)}</div>
              </div>
            )}
          </div>
        </details>

        {/* ── ¿Para quién? Se auto-segmenta y descubre el cross-sell madre+hija ── */}
        <section className="mt-12">
          <h2 className="text-2xl text-center mb-6" style={{ fontFamily: serif, color: C.burgundy }}>¿Para quién es la plaza?</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl p-6 flex flex-col text-center" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
              <p className="text-3xl mb-2">🩰</p>
              <p className="text-xl font-semibold mb-1" style={{ fontFamily: serif, color: C.burgundy }}>Para mi hija</p>
              <p className="text-sm leading-relaxed flex-1 mb-5" style={{ color: C.brown }}>Ballet: Pre-Ballet (3–6), Ballet I (7–9) y Ballet II (10–14).</p>
              <Cta>Reservar su plaza</Cta>
            </div>
            <div className="rounded-3xl p-6 flex flex-col text-center" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
              <p className="text-3xl mb-2">💪</p>
              <p className="text-xl font-semibold mb-1" style={{ fontFamily: serif, color: C.burgundy }}>Para mí</p>
              <p className="text-sm leading-relaxed flex-1 mb-5" style={{ color: C.brown }}>Barre Fit y Pilates Mat, en horario de mañana y de tarde.</p>
              <Cta>Reservar mi plaza</Cta>
            </div>
          </div>
          <p className="text-sm text-center mt-4" style={{ color: C.brown }}>
            🎁 <strong style={{ color: C.burgundy }}>¿Venís las dos?</strong> Apunta a tu hija y apúntate tú: usa el código{" "}
            <strong style={{ color: C.burgundy }}>JUNTAS</strong> al pagar y tu matrícula es gratis.
          </p>
        </section>

        {/* ── Cómo pagar ── */}
        <section className="mt-14">
          <h2 className="text-2xl text-center mb-6" style={{ fontFamily: serif, color: C.burgundy }}>Cómo pagar</h2>
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl p-5 flex items-start gap-4" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
              <span className="text-2xl">💳</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm mb-0.5" style={{ color: C.dark, fontFamily: sans }}>Ahora, con tarjeta</p>
                <p className="text-sm" style={{ color: C.brown }}>Eliges horario y en dos minutos tu plaza queda reservada.</p>
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
              Te lo digo con honestidad — las tardes de ballet y las mañanas de Barre son las primeras en llenarse,
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
