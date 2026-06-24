"use client";

import { useState } from "react";
import type { DisciplinaId } from "./types";
import { submitProfiloMarketing, type ProfiloMarketing } from "@/lib/queries";

const DISCIPLINAS_NINAS = new Set<DisciplinaId>(["pre-ballet", "ballet-i", "ballet-ii"]);

const COMO_OPTIONS = [
  { value: "social", label: "Anuncio en redes sociales" },
  { value: "google", label: "Google" },
  { value: "flyer", label: "Flyer" },
  { value: "boca_a_boca", label: "Boca a boca" },
  { value: "conosco_andrea", label: "Ya conozco a Andrea" },
];

const RED_SOCIAL_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "ambas", label: "Las dos por igual" },
];

const MOTIVACION_OPTIONS = [
  { value: "nueva_rutina", label: "Quiero crear una nueva rutina" },
  { value: "vuelta_deporte", label: "Vuelvo al deporte" },
  { value: "recomendacion_medica", label: "Recomendación médica" },
  { value: "recomendacion_amiga", label: "Me lo recomendó alguien" },
  { value: "siempre_quise", label: "Siempre quise probarlo" },
];

const EDAD_OPTIONS = [
  { value: "18-30", label: "18 – 30" },
  { value: "31-45", label: "31 – 45" },
  { value: "46-60", label: "46 – 60" },
  { value: "60+", label: "Más de 60" },
];

const EDAD_FIGLIA_OPTIONS = [
  { value: "3-4", label: "3 – 4 años" },
  { value: "5-6", label: "5 – 6 años" },
  { value: "7-9", label: "7 – 9 años" },
  { value: "10-12", label: "10 – 14 años" },
];

const OBJETIVO_OPTIONS = [
  { value: "disciplina", label: "Disciplina y constancia" },
  { value: "expresion", label: "Expresión artística" },
  { value: "actividad_fisica", label: "Actividad física saludable" },
  { value: "socializar", label: "Socializar y divertirse" },
];

interface Props {
  iscrizioneId: string;
  disciplinaId: DisciplinaId;
  nombre: string;
  // Modo previsualización (solo admin): no guarda nada en la base de datos.
  preview?: boolean;
}

type Step = "gracias" | "form" | "done";

export default function Paso5Gracias({ iscrizioneId, disciplinaId, nombre, preview }: Props) {
  const [step, setStep] = useState<Step>("gracias");
  const [enviando, setEnviando] = useState(false);

  const esNinas = DISCIPLINAS_NINAS.has(disciplinaId);

  const [como, setComo] = useState("");
  const [redSocial, setRedSocial] = useState("");
  const [motivacion, setMotivacion] = useState("");
  const [edad, setEdad] = useState("");
  const [expPrevia, setExpPrevia] = useState<boolean | null>(null);
  const [edadFiglia, setEdadFiglia] = useState("");
  const [expFiglia, setExpFiglia] = useState<boolean | null>(null);
  const [objetivo, setObjetivo] = useState("");

  // Todas las preguntas son opcionales: solo se guarda lo que la persona haya
  // respondido. El cuestionario completo ya es opcional, así que el botón
  // "Enviar" está siempre activo.
  const handleSubmit = async () => {
    setEnviando(true);
    try {
      // En previsualización no se escribe nada: directo a la pantalla final.
      if (preview) { setStep("done"); return; }
      const profilo: ProfiloMarketing = { iscrizione_id: iscrizioneId };
      if (como) profilo.come_ci_hai_conosciuto = como;
      if (redSocial) profilo.red_social = redSocial;
      if (esNinas) {
        if (edadFiglia) profilo.eta_figlia = edadFiglia;
        if (expFiglia !== null) profilo.esperienza_previa_figlia = expFiglia;
        if (objetivo) profilo.obiettivo_figlia = objetivo;
      } else {
        if (motivacion) profilo.motivazione = motivacion;
        if (edad) profilo.fascia_eta = edad;
        if (expPrevia !== null) profilo.esperienza_previa = expPrevia;
      }
      await submitProfiloMarketing(profilo);
      setStep("done");
    } catch {
      // silent — no bloqueamos al usuario si falla
      setStep("done");
    } finally {
      setEnviando(false);
    }
  };

  const chipStyle = (selected: boolean) => ({
    padding: "10px 18px",
    borderRadius: "999px",
    border: selected ? "2px solid #7d2b13" : "2px solid #dcc1b9",
    backgroundColor: selected ? "#ffdbd1" : "#fff8f5",
    color: selected ? "#7d2b13" : "#56423d",
    cursor: "pointer",
    fontSize: "0.875rem",
    fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
    transition: "all 0.2s ease",
    outline: "none",
  });

  const sectionTitle = (text: string) => (
    <p className="text-sm font-semibold mb-3" style={{ color: "#7d2b13", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>
      {text}
    </p>
  );

  if (step === "gracias") {
    return (
      <div className="max-w-xl mx-auto px-8 py-16 text-center">
        <div className="mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: "#ffdbd1" }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 16l7 7L26 9" stroke="#7d2b13" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-4xl sm:text-5xl mb-4" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}>
            ¡Gracias, {nombre}!
          </h2>
          <p className="text-base leading-relaxed" style={{ color: "#56423d" }}>
            Me alegra mucho confirmar tu reserva ✨<br /><br />
            En unos minutos recibirás un mail de resumen con todos los detalles. Si no lo ves en la bandeja de entrada, revisa la carpeta de spam, que a veces se cuela por ahí.<br /><br />
            Cualquier cosa que necesites, tienes mi número en la web. Estaré encantada de ayudarte.<br /><br />
            ¡Hasta pronto!<br />
            <strong>Andrea</strong>
          </p>
        </div>

        <div className="rounded-3xl p-8" style={{ backgroundColor: "#fff0eb", border: "1px solid #dcc1b9" }}>
          <p className="text-lg mb-2" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#25190f" }}>
            ¿Me cuentas un poco más sobre ti?
          </p>
          <p className="text-sm mb-6" style={{ color: "#89726c" }}>
            Solo un minuto — me ayuda a preparar mejor tu primera clase.
          </p>
          <button
            onClick={() => setStep("form")}
            className="w-full py-3 rounded-2xl text-sm font-semibold tracking-widest uppercase transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#7d2b13", color: "#fff8f5", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif", letterSpacing: "0.1em" }}
          >
            Claro, te cuento
          </button>
          <button
            onClick={() => setStep("done")}
            className="w-full mt-2 py-2 text-xs tracking-widest uppercase hover:opacity-70 transition-opacity"
            style={{ color: "#89726c", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
          >
            Ahora no
          </button>
        </div>
      </div>
    );
  }

  if (step === "form") {
    return (
      <div className="max-w-xl mx-auto px-8 py-12">
        <h2 className="text-3xl mb-10 text-center" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}>
          Conociéndonos mejor
        </h2>

        <div className="space-y-8">
          {/* Como nos conociste */}
          <div>
            {sectionTitle("¿Cómo nos has conocido?")}
            <div className="flex flex-wrap gap-2">
              {COMO_OPTIONS.map((o) => (
                <button key={o.value} onClick={() => setComo(o.value)} style={chipStyle(como === o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Red social favorita */}
          <div>
            {sectionTitle("¿Qué red social usas más?")}
            <div className="flex flex-wrap gap-2">
              {RED_SOCIAL_OPTIONS.map((o) => (
                <button key={o.value} onClick={() => setRedSocial(o.value)} style={chipStyle(redSocial === o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {esNinas ? (
            <>
              {/* Edad de la hija */}
              <div>
                {sectionTitle("¿Cuántos años tiene tu hija?")}
                <div className="flex flex-wrap gap-2">
                  {EDAD_FIGLIA_OPTIONS.map((o) => (
                    <button key={o.value} onClick={() => setEdadFiglia(o.value)} style={chipStyle(edadFiglia === o.value)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Experiencia previa */}
              <div>
                {sectionTitle("¿Ha hecho danza antes?")}
                <div className="flex gap-2">
                  <button onClick={() => setExpFiglia(true)} style={chipStyle(expFiglia === true)}>Sí</button>
                  <button onClick={() => setExpFiglia(false)} style={chipStyle(expFiglia === false)}>No, es la primera vez</button>
                </div>
              </div>

              {/* Objetivo */}
              <div>
                {sectionTitle("¿Qué buscas para ella?")}
                <div className="flex flex-wrap gap-2">
                  {OBJETIVO_OPTIONS.map((o) => (
                    <button key={o.value} onClick={() => setObjetivo(o.value)} style={chipStyle(objetivo === o.value)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Motivacion */}
              <div>
                {sectionTitle("¿Qué te ha animado a empezar?")}
                <div className="flex flex-wrap gap-2">
                  {MOTIVACION_OPTIONS.map((o) => (
                    <button key={o.value} onClick={() => setMotivacion(o.value)} style={chipStyle(motivacion === o.value)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Edad */}
              <div>
                {sectionTitle("Tu edad")}
                <div className="flex flex-wrap gap-2">
                  {EDAD_OPTIONS.map((o) => (
                    <button key={o.value} onClick={() => setEdad(o.value)} style={chipStyle(edad === o.value)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Experiencia previa */}
              <div>
                {sectionTitle("¿Tienes experiencia previa?")}
                <div className="flex gap-2">
                  <button onClick={() => setExpPrevia(true)} style={chipStyle(expPrevia === true)}>Sí</button>
                  <button onClick={() => setExpPrevia(false)} style={chipStyle(expPrevia === false)}>No, empiezo desde cero</button>
                </div>
              </div>
            </>
          )}

          <button
            onClick={handleSubmit}
            disabled={enviando}
            className="w-full py-3 rounded-2xl text-sm font-semibold tracking-widest uppercase transition-opacity"
            style={{
              backgroundColor: "#7d2b13",
              color: "#fff8f5",
              fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
              letterSpacing: "0.1em",
              cursor: enviando ? "not-allowed" : "pointer",
              opacity: enviando ? 0.7 : 1,
            }}
          >
            {enviando ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    );
  }

  // done
  return (
    <div className="max-w-xl mx-auto px-8 py-20 text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: "#ffdbd1" }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M14 4C8.477 4 4 8.477 4 14s4.477 10 10 10 10-4.477 10-10S19.523 4 14 4zm-1 14l-4-4 1.41-1.41L13 15.17l5.59-5.58L20 11l-7 7z" fill="#7d2b13" />
        </svg>
      </div>
      <h2 className="text-3xl mb-3" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}>
        ¡Muchas gracias!
      </h2>
      <p className="text-base mb-6" style={{ color: "#56423d" }}>
        Nos vemos pronto en el estudio. Únete al grupo de WhatsApp de las familias para estar al tanto de todo.
      </p>

      <a
        href="https://chat.whatsapp.com/Gi2SUxvVc0xCqtw8egpkQu?mode=gi_t"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl text-white font-semibold shadow-lg hover:opacity-90 transition-opacity mb-3"
        style={{ backgroundColor: "#25D366", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.477-1.717zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
        </svg>
        Unirme al grupo de WhatsApp
      </a>

      <a
        href="https://andreacarriostudio.es/"
        className="inline-block w-full py-3 rounded-2xl text-sm font-semibold tracking-widest uppercase transition-opacity hover:opacity-80 border text-center"
        style={{ borderColor: "#7d2b13", color: "#7d2b13", backgroundColor: "transparent", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif", letterSpacing: "0.1em" }}
      >
        Volver a la página de inicio
      </a>
    </div>
  );
}
