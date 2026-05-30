import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ballet para Niñas en Valencia: beneficios, edad ideal y cómo elegir bien — Andrea Carrió Studio",
  description: "¿Estás pensando en apuntar a tu hija al ballet? Te cuento los beneficios, la edad ideal y cómo saber si es el momento.",
};

const c = {
  primary: "#5d1416",
  secondary: "#984444",
  bg: "#fff8f4",
  surfaceLow: "#fcf2ea",
  text: "#1f1b16",
  textMuted: "#554241",
  white: "#ffffff",
  primarySoft: "rgba(93,20,22,0.1)",
  primaryMid: "rgba(93,20,22,0.4)",
};

const f = {
  serif: "'Playfair Display', Georgia, serif",
  sans: "'Montserrat', system-ui, sans-serif",
};

export default function BalletParaNinasPage() {
  return (
    <div style={{ background: c.bg, color: c.text, fontFamily: f.sans }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />

      {/* Hero */}
      <section
        style={{
          position: "relative",
          width: "100%",
          height: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <img
          alt="Clases de ballet para niñas en Valencia"
          src="https://andreacarriostudio.es/wp-content/uploads/2026/05/WhatsApp-Image-2026-05-20-at-00.30.34.jpeg"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "grayscale(20%) contrast(1.1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: c.primaryMid,
          }}
        />
        <div style={{ position: "relative", zIndex: 10, textAlign: "center", padding: "0 20px", maxWidth: 800 }}>
          <h1
            style={{
              fontFamily: f.serif,
              fontSize: "clamp(32px, 5vw, 48px)",
              fontWeight: 500,
              color: c.white,
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            Ballet para Niñas en Valencia: beneficios, edad ideal y cómo elegir bien
          </h1>
        </div>
      </section>

      {/* Article */}
      <article style={{ maxWidth: 800, margin: "0 auto", padding: "80px 24px" }}>

        {/* Intro */}
        <div style={{ marginBottom: 64 }}>
          <p
            style={{
              fontFamily: f.sans,
              fontSize: 18,
              fontWeight: 300,
              lineHeight: 1.7,
              color: c.textMuted,
              fontStyle: "italic",
              borderLeft: `2px solid ${c.primary}`,
              paddingLeft: 32,
              margin: 0,
            }}
          >
            "¿Estará feliz?", "¿es demasiado pequeña?", "¿realmente le servirá para algo?". Estas son las preguntas que toda madre se hace cuando ve a su hija dar sus primeros giros espontáneos en el salón de casa.
          </p>
        </div>

        {/* Sección 1: Beneficios */}
        <section style={{ marginBottom: 64 }}>
          <h2
            style={{
              fontFamily: f.serif,
              fontSize: 32,
              fontWeight: 500,
              color: c.primary,
              marginBottom: 40,
              marginTop: 0,
            }}
          >
            ¿Por qué el ballet es una de las mejores actividades para tu hija?
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 32,
            }}
          >
            {[
              {
                icon: "accessibility_new",
                title: "Coordinación",
                text: "Desarrolla el control motor fino y grueso desde una edad temprana.",
              },
              {
                icon: "self_improvement",
                title: "Postura",
                text: "Fortalece la columna y crea una elegancia natural en el movimiento cotidiano.",
              },
              {
                icon: "psychology",
                title: "Disciplina",
                text: "Fomenta la concentración, el respeto por el turno y el trabajo en equipo.",
              },
            ].map((item) => (
              <div key={item.title}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: c.secondary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ color: c.white, fontSize: 18, fontVariationSettings: "'FILL' 1" }}
                  >
                    {item.icon}
                  </span>
                </div>
                <h3
                  style={{
                    fontFamily: f.sans,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: c.primary,
                    marginBottom: 12,
                    marginTop: 0,
                  }}
                >
                  {item.title}
                </h3>
                <p style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 300, lineHeight: 1.6, color: c.textMuted, margin: 0 }}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Sección 2: Edad ideal */}
        <section style={{ marginBottom: 64, display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center" }}>
          <div style={{ flex: "1 1 260px" }}>
            <h2
              style={{
                fontFamily: f.serif,
                fontSize: 32,
                fontWeight: 500,
                color: c.primary,
                marginBottom: 24,
                marginTop: 0,
              }}
            >
              ¿A qué edad pueden empezar las niñas ballet?
            </h2>
            <p style={{ fontFamily: f.sans, fontSize: 17, fontWeight: 300, lineHeight: 1.7, color: c.textMuted, marginBottom: 16, marginTop: 0 }}>
              En Andrea Carrió Studio consideramos que los 3 años es la edad ideal para comenzar. A esta edad, el enfoque no es la técnica rígida, sino el <strong>pre-ballet</strong>.
            </p>
            <p style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 300, lineHeight: 1.7, color: c.textMuted, margin: 0 }}>
              Es el momento de explorar el espacio, reconocer el ritmo musical y empezar a socializar a través del juego dirigido y la expresión corporal artística.
            </p>
          </div>
          <div style={{ flex: "1 1 260px" }}>
            <img
              alt="Pre-ballet para niñas pequeñas"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBK38fsb07DlrMLy0kTiyd3lmVlyIdzx383kvh2-JAPKHIW8o1kTncs6kbBu_VW9WeAZzkALh2KIEM3SjpUvwDrmTK--_WiyN9tzPF4N8qszf7Z4qwh4tF2WW6N3dNLIEOu2Jf3v4vEt_hM46WWPmpRPbLfY9TurpPoSC0wHcbf5XeByoTHeWxkG9VfeaT-oFhtALNid3Tp6M5EhUuTKPqeUQ5ZUFm_A_sc79kSlItKU6WmPBXiUBhnoi0mhDtgtQEaPzNF8kctTY4"
              style={{ width: "100%", aspectRatio: "4/5", objectFit: "cover", display: "block" }}
            />
          </div>
        </section>

        {/* Sección 3: ¿Disfrutará? */}
        <section
          style={{
            marginBottom: 64,
            background: c.surfaceLow,
            padding: "40px 48px",
            borderLeft: `4px solid ${c.primary}`,
          }}
        >
          <h2
            style={{
              fontFamily: f.serif,
              fontSize: 32,
              fontWeight: 500,
              color: c.primary,
              marginBottom: 24,
              marginTop: 0,
            }}
          >
            ¿Cómo saber si tu hija va a disfrutar las clases?
          </h2>
          <p style={{ fontFamily: f.sans, fontSize: 17, fontWeight: 300, lineHeight: 1.7, color: c.textMuted, marginBottom: 24, marginTop: 0 }}>
            Observa su lenguaje corporal cuando suena música. Si tiende a moverse con delicadeza, si le gusta el orden o si simplemente busca una vía para expresar su mundo interior, el ballet será su refugio.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              "Interés natural por la música clásica o instrumental.",
              "Curiosidad por los trajes y la estética de la danza.",
              "Deseo de aprender nuevas formas de moverse.",
            ].map((item) => (
              <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <span className="material-symbols-outlined" style={{ color: c.primary, marginTop: 2, flexShrink: 0 }}>
                  check_circle
                </span>
                <span style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 300, lineHeight: 1.6 }}>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Sección 4: Módulos */}
        <section style={{ marginBottom: 64 }}>
          <h2
            style={{
              fontFamily: f.serif,
              fontSize: 32,
              fontWeight: 500,
              color: c.primary,
              marginBottom: 40,
              marginTop: 0,
              textAlign: "center",
            }}
          >
            Qué aprende una niña en cada clase
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
            {[
              {
                num: "MÓDULO 1",
                title: "Musicalidad y Ritmo",
                text: "Entender la música no solo como sonido, sino como una instrucción para el cuerpo.",
              },
              {
                num: "MÓDULO 2",
                title: "Vocabulario Técnico",
                text: "Primeros pasos: pliés, tendus y posiciones básicas con sus nombres en francés.",
              },
            ].map((item) => (
              <div key={item.num} style={{ padding: 32, border: `1px solid ${c.primarySoft}` }}>
                <span
                  style={{
                    fontFamily: f.sans,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.15em",
                    color: "rgba(93,20,22,0.5)",
                    textTransform: "uppercase",
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  {item.num}
                </span>
                <h3
                  style={{
                    fontFamily: f.serif,
                    fontSize: 24,
                    fontWeight: 500,
                    marginBottom: 16,
                    marginTop: 0,
                  }}
                >
                  {item.title}
                </h3>
                <p style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 300, lineHeight: 1.6, color: c.textMuted, margin: 0 }}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section
          style={{
            marginBottom: 64,
            textAlign: "center",
            background: c.primary,
            padding: "64px 24px",
          }}
        >
          <h2
            style={{
              fontFamily: f.serif,
              fontSize: 32,
              fontWeight: 500,
              color: c.white,
              marginBottom: 24,
              marginTop: 0,
            }}
          >
            Clases de ballet para niñas en Alfahuir, Valencia
          </h2>
          <p
            style={{
              fontFamily: f.sans,
              fontSize: 17,
              fontWeight: 300,
              lineHeight: 1.7,
              color: "#ff9692",
              marginBottom: 40,
              marginTop: 0,
              maxWidth: 500,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Nuestro estudio en Valencia ofrece un ambiente seguro y profesional donde el arte se vive en cada rincón. Reserva hoy una clase de prueba gratuita.
          </p>
          <a
            href="#"
            style={{
              display: "inline-block",
              background: c.white,
              color: c.primary,
              padding: "16px 48px",
              fontFamily: f.sans,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            RESERVAR CLASE DE PRUEBA
          </a>
        </section>

        {/* FAQ */}
        <section style={{ marginBottom: 64 }}>
          <h2
            style={{
              fontFamily: f.serif,
              fontSize: 32,
              fontWeight: 500,
              color: c.primary,
              marginBottom: 32,
              marginTop: 0,
            }}
          >
            Preguntas frecuentes sobre ballet para niñas
          </h2>
          <div style={{ borderTop: `1px solid ${c.primarySoft}` }}>
            {[
              {
                q: "¿Es necesario llevar uniforme desde el primer día?",
                a: "Para la clase de prueba puede venir con ropa cómoda y calcetines. Una vez inscrita, proporcionamos la guía del uniforme reglamentario del estudio.",
              },
              {
                q: "¿Hay presentaciones a final de curso?",
                a: "Sí, organizamos una gala anual donde las alumnas muestran su progreso en un escenario profesional, fomentando su confianza.",
              },
              {
                q: "¿Cuál es la duración de las clases?",
                a: "Las clases para las más pequeñas duran 45-50 minutos, tiempo óptimo para mantener su foco y energía.",
              },
            ].map((item) => (
              <details
                key={item.q}
                style={{ borderBottom: `1px solid ${c.primarySoft}`, padding: "24px 0" }}
              >
                <summary
                  style={{
                    fontFamily: f.sans,
                    fontSize: 17,
                    fontWeight: 400,
                    cursor: "pointer",
                    listStyle: "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  {item.q}
                  <span className="material-symbols-outlined" style={{ color: c.primary, flexShrink: 0 }}>
                    expand_more
                  </span>
                </summary>
                <p
                  style={{
                    fontFamily: f.sans,
                    fontSize: 15,
                    fontWeight: 300,
                    lineHeight: 1.7,
                    color: c.textMuted,
                    marginTop: 16,
                    marginBottom: 0,
                  }}
                >
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

      </article>
    </div>
  );
}
