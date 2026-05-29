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
  { value: "10-12", label: "10 – 12 años" },
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
}

type Step = "gracias" | "form" | "done";

export default function Paso5Gracias({ iscrizioneId, disciplinaId, nombre }: Props) {
  const [step, setStep] = useState<Step>("gracias");
  const [enviando, setEnviando] = useState(false);

  const esNinas = DISCIPLINAS_NINAS.has(disciplinaId);

  const [como, setComo] = useState("");
  const [motivacion, setMotivacion] = useState("");
  const [edad, setEdad] = useState("");
  const [expPrevia, setExpPrevia] = useState<boolean | null>(null);
  const [edadFiglia, setEdadFiglia] = useState("");
  const [expFiglia, setExpFiglia] = useState<boolean | null>(null);
  const [objetivo, setObjetivo] = useState("");

  const formValido = esNinas
    ? como !== "" && edadFiglia !== "" && expFiglia !== null && objetivo !== ""
    : como !== "" && motivacion !== "" && edad !== "" && expPrevia !== null;

  const handleSubmit = async () => {
    if (!formValido) return;
    setEnviando(true);
    try {
      const profilo: ProfiloMarketing = { iscrizione_id: iscrizioneId, come_ci_hai_conosciuto: como };
      if (esNinas) {
        profilo.eta_figlia = edadFiglia;
        profilo.esperienza_previa_figlia = expFiglia!;
        profilo.obiettivo_figlia = objetivo;
      } else {
        profilo.motivazione = motivacion;
        profilo.fascia_eta = edad;
        profilo.esperienza_previa = expPrevia!;
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
        <h2 className="text-3xl mb-2 text-center" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}>
          Conociéndonos mejor
        </h2>
        <p className="text-sm text-center mb-10" style={{ color: "#89726c" }}>
          {esNinas ? "Cuéntanos un poco sobre tu hija." : "Cuéntanos un poco sobre ti."}
        </p>

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
            disabled={!formValido || enviando}
            className="w-full py-3 rounded-2xl text-sm font-semibold tracking-widest uppercase transition-opacity"
            style={{
              backgroundColor: formValido ? "#7d2b13" : "#dcc1b9",
              color: "#fff8f5",
              fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
              letterSpacing: "0.1em",
              cursor: formValido ? "pointer" : "not-allowed",
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
      <p className="text-base mb-8" style={{ color: "#56423d" }}>
        Nos vemos pronto en el estudio.
      </p>
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
