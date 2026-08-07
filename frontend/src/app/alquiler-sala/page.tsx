import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alquiler de sala de baile en Valencia por horas — Andrea Carrió Studio",
  description:
    "Alquila una sala de baile en Valencia (zona Alfahuir) por horas: 50 m², parquet, espejos, barras de ballet y vestuario. Ideal para talleres, clases y ensayos. Consúltanos por WhatsApp.",
};

const C = {
  burgundy: "#7d2b13",
  burgundyDark: "#5d1e0d",
  blush: "#ffdbd1",
  cream: "#fff8f5",
  bg: "#f5ede8",
  brown: "#56423d",
  muted: "#89726c",
  border: "#e6d3cb",
  dark: "#25190f",
  wa: "#25D366",
};
const fSerif = "var(--font-playfair), 'Playfair Display', Georgia, serif";
const fSans = "var(--font-montserrat), 'Montserrat', system-ui, sans-serif";

const WA_MSG = "¡Hola! Me interesa alquilar la sala de baile. ¿Me pasáis disponibilidad y tarifas?";
const WA_URL = `https://wa.me/34614679291?text=${encodeURIComponent(WA_MSG)}`;

const CARACTERISTICAS = [
  { icon: "📐", t: "50 m² diáfanos", s: "Espacio amplio y despejado para moverte con libertad." },
  { icon: "🪵", t: "Suelo de parquet", s: "Superficie cálida y apta para danza y actividad física." },
  { icon: "🪞", t: "Espejos y barras", s: "Pared de espejos y barras de ballet fijas." },
  { icon: "👥", t: "Aforo para 12", s: "Ideal para grupos reducidos y clases cercanas." },
  { icon: "🚪", t: "Vestuario", s: "Para que tú y tus alumnas os cambiéis con comodidad." },
  { icon: "📍", t: "Zona Alfahuir", s: "En Valencia, a 5 min del CC Arena." },
];

const TAUPE = "#a4917f";
const TAUPE_TEXT = "#33291f";

// Fotos de los servicios (círculos). Rellena "img" con la URL de cada foto
// cuando las subas a WordPress; mientras esté vacío se muestra un círculo con
// degradado + emoji para que la maqueta no se rompa.
const SERVICIOS = [
  {
    img: "https://andreacarriostudio.es/wp-content/uploads/2026/08/DSC5073.jpg",
    emoji: "🎪",
    title: "Eventos fitness",
    text: "Alquilamos el espacio para eventos fitness y encuentros puntuales. Un entorno amplio, cuidado y preparado para actividades de movimiento y entrenamiento.",
  },
  {
    img: "https://andreacarriostudio.es/wp-content/uploads/2026/08/DSC5201.jpg",
    emoji: "🎓",
    title: "Formaciones y cursos",
    text: "El estudio está disponible para formaciones, cursos y talleres. Un espacio tranquilo y funcional, ideal para el aprendizaje y la práctica.",
  },
  {
    img: "https://andreacarriostudio.es/wp-content/uploads/2026/08/IMG_0219-scaled.jpeg",
    emoji: "🩰",
    title: "Alquiler de material Barre",
    text: "Alquiler de material de Barre, incluidas barras, para eventos, clases puntuales o formaciones. Una solución flexible para disponer de equipamiento profesional sin inversión previa.",
  },
];

const FAQS = [
  { q: "¿Cómo reservo la sala?", a: "Escríbenos por WhatsApp y te pasamos la disponibilidad y las tarifas al momento. Cerramos tu franja y listo." },
  { q: "¿Para qué actividades se puede alquilar?", a: "Danza, pilates, yoga, barre, talleres, ensayos… cualquier disciplina de movimiento. La sala está equipada con espejos y barras." },
  { q: "¿Qué incluye la sala?", a: "50 m² diáfanos con suelo de parquet, pared de espejos, barras de ballet, vestuario y aforo para 12 personas." },
  { q: "¿Dónde está y cuándo está disponible?", a: "En Valencia, zona Alfahuir (a 5 min del CC Arena). Disponible de lunes a domingo, con alquiler por horas según disponibilidad." },
];

export default function AlquilerSalaPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div style={{ background: C.bg, color: C.dark, fontFamily: fSans }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Hero */}
      <section
        style={{
          background: `linear-gradient(rgba(93,30,13,0.74), rgba(45,20,9,0.86)), url('https://andreacarriostudio.es/wp-content/uploads/2026/08/IMG_0213-scaled.jpeg') center/cover no-repeat`,
          padding: "88px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <p style={{ fontFamily: fSans, fontSize: 13, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: C.blush, margin: "0 0 16px" }}>
            Valencia · Zona Alfahuir
          </p>
          <h1 style={{ fontFamily: fSerif, fontSize: "clamp(30px, 5vw, 46px)", fontWeight: 500, color: "#fff", lineHeight: 1.2, margin: "0 0 18px" }}>
            Alquiler de sala de baile en Valencia
          </h1>
          <p style={{ fontFamily: fSans, fontSize: 18, fontWeight: 300, lineHeight: 1.7, color: "#ffe9e2", margin: "0 auto 32px", maxWidth: 560 }}>
            Una sala equipada por horas para tus clases, talleres o ensayos. Parquet, espejos y barras, lista para danza, pilates o yoga.
          </p>
          <a
            href={WA_URL}
            style={{
              display: "inline-block",
              background: C.wa,
              color: "#fff",
              padding: "16px 36px",
              borderRadius: 9999,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 17,
            }}
          >
            📲 Consultar disponibilidad por WhatsApp
          </a>
        </div>
      </section>

      {/* La sala */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "72px 24px 40px" }}>
        <h2 style={{ fontFamily: fSerif, fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 500, color: C.burgundy, textAlign: "center", margin: "0 0 40px" }}>
          La sala
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {CARACTERISTICAS.map((c) => (
            <div key={c.t} style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px 22px" }}>
              <div style={{ fontSize: 30, marginBottom: 12 }}>{c.icon}</div>
              <h3 style={{ fontFamily: fSans, fontSize: 17, fontWeight: 700, color: C.burgundy, margin: "0 0 6px" }}>{c.t}</h3>
              <p style={{ fontFamily: fSans, fontSize: 15, fontWeight: 300, lineHeight: 1.6, color: C.brown, margin: 0 }}>{c.s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Servicios de alquiler — 3 círculos (curva superior) */}
      <div style={{ background: C.bg, lineHeight: 0 }}>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 48 }} aria-hidden="true">
          <path d="M0,0 C400,80 1040,80 1440,0 L1440,80 L0,80 Z" fill={TAUPE} />
        </svg>
      </div>
      <section style={{ background: TAUPE, padding: "20px 24px 56px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <h2 style={{ fontFamily: fSerif, fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 500, color: C.cream, textAlign: "center", margin: "0 0 44px" }}>
            Para qué puedes alquilarla
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 40 }}>
            {SERVICIOS.map((s) => (
              <div key={s.title} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <div
                  style={{
                    width: 210,
                    height: 210,
                    maxWidth: "100%",
                    borderRadius: "50%",
                    overflow: "hidden",
                    margin: "0 0 26px",
                    background: `linear-gradient(135deg, ${C.burgundy}, ${C.burgundyDark})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 12px 32px rgba(0,0,0,0.20)",
                  }}
                >
                  {s.img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.img} alt={s.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: 64 }} aria-hidden="true">{s.emoji}</span>
                  )}
                </div>
                <h3 style={{ fontFamily: fSerif, fontSize: 26, fontWeight: 500, color: C.cream, lineHeight: 1.2, margin: "0 0 16px" }}>{s.title}</h3>
                <p style={{ fontFamily: fSans, fontSize: 14, fontWeight: 300, lineHeight: 1.7, color: TAUPE_TEXT, margin: "0 0 26px", maxWidth: 300 }}>{s.text}</p>
                <a
                  href={WA_URL}
                  style={{
                    marginTop: "auto",
                    display: "block",
                    width: "100%",
                    maxWidth: 320,
                    background: "#2e2a26",
                    color: C.cream,
                    padding: "15px 24px",
                    borderRadius: 9999,
                    textDecoration: "none",
                    fontFamily: fSans,
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: "center",
                  }}
                >
                  + info
                </a>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: fSans, fontSize: 15, fontWeight: 300, lineHeight: 1.7, color: TAUPE_TEXT, textAlign: "center", margin: "40px 0 0" }}>
            Disponible de <strong>lunes a domingo</strong> · alquiler por horas según disponibilidad.
          </p>
        </div>
      </section>
      {/* curva inferior */}
      <div style={{ background: TAUPE, lineHeight: 0 }}>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 48 }} aria-hidden="true">
          <path d="M0,80 C400,0 1040,0 1440,80 L1440,0 L0,0 Z" fill={C.bg} />
        </svg>
      </div>

      {/* CTA */}
      <section style={{ background: `linear-gradient(135deg, ${C.burgundy}, ${C.burgundyDark})`, padding: "56px 24px", textAlign: "center", margin: "24px 0 0" }}>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <h2 style={{ fontFamily: fSerif, fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 500, color: "#fff", margin: "0 0 14px" }}>
            Consúltanos disponibilidad y tarifas
          </h2>
          <p style={{ fontFamily: fSans, fontSize: 17, fontWeight: 300, lineHeight: 1.7, color: "#ffe9e2", margin: "0 0 30px" }}>
            Escríbenos por WhatsApp: te contamos horarios libres, precio y te guardamos tu franja.
          </p>
          <a
            href={WA_URL}
            style={{ display: "inline-block", background: C.wa, color: "#fff", padding: "16px 40px", borderRadius: 9999, textDecoration: "none", fontWeight: 700, fontSize: 17 }}
          >
            📲 Escríbenos por WhatsApp
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "64px 24px 80px" }}>
        <h2 style={{ fontFamily: fSerif, fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 500, color: C.burgundy, margin: "0 0 28px" }}>
          Preguntas frecuentes
        </h2>
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {FAQS.map((f) => (
            <details key={f.q} style={{ borderBottom: `1px solid ${C.border}`, padding: "22px 0" }}>
              <summary style={{ fontFamily: fSans, fontSize: 17, fontWeight: 600, color: C.dark, cursor: "pointer", listStyle: "none" }}>
                {f.q}
              </summary>
              <p style={{ fontFamily: fSans, fontSize: 15, fontWeight: 300, lineHeight: 1.7, color: C.brown, margin: "14px 0 0" }}>
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Dónde estamos */}
      <section style={{ maxWidth: 860, margin: "0 auto", padding: "8px 24px 80px", textAlign: "center" }}>
        <p style={{ fontFamily: fSans, fontSize: 13, fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted, margin: "0 0 8px" }}>
          Dónde estamos
        </p>
        <h2 style={{ fontFamily: fSerif, fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 500, color: C.burgundy, margin: "0 0 8px" }}>
          📍 En el corazón de Alfahuir
        </h2>
        <p style={{ fontFamily: fSans, fontSize: 15, fontWeight: 300, lineHeight: 1.6, color: C.dark, margin: "0 0 20px" }}>
          Carrer de Motilla del Palancar 34 · Alfahuir, Valencia · a 5 min del CC Arena
        </p>
        <div style={{ borderRadius: 24, overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,0.12)", border: `1px solid ${C.border}` }}>
          <iframe
            title="Ubicación de Andrea Carrió Studio"
            src="https://www.google.com/maps?q=Carrer+de+Motilla+del+Palancar+34,+46019+Val%C3%A8ncia&z=16&output=embed"
            width="100%"
            height="320"
            style={{ border: 0, display: "block", pointerEvents: "none" }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <a
          href="https://www.google.com/maps/search/?api=1&query=Carrer+de+Motilla+del+Palancar+34,+46019+Val%C3%A8ncia"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-block", marginTop: 16, fontFamily: fSans, fontSize: 15, fontWeight: 600, color: C.burgundy, textDecoration: "none" }}
        >
          Cómo llegar →
        </a>
      </section>
    </div>
  );
}
