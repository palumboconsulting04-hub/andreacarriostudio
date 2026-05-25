"use client";

import { useState, useEffect } from "react";
import StepIndicator from "@/components/inscripcion/StepIndicator";
import Paso1Disciplina from "@/components/inscripcion/Paso1Disciplina";
import Paso2Plan from "@/components/inscripcion/Paso2Plan";
import Paso3Horarios from "@/components/inscripcion/Paso3Horarios";
import Paso4Pago from "@/components/inscripcion/Paso4Pago";
import Paso4CrossSell from "@/components/inscripcion/Paso4CrossSell";
import Paso5Gracias from "@/components/inscripcion/Paso5Gracias";
import type { InscripcionState, BozzaIscrizione, Disciplina, Plan, HorarioSlot, DisciplinaId, PlanId } from "@/components/inscripcion/types";
import { fetchDiscipline, fetchPiani, fetchOrari } from "@/lib/queries";

const DISCIPLINAS_NINAS = new Set<DisciplinaId>(["pre-ballet", "ballet-i", "ballet-ii"]);

const estadoInicial: InscripcionState = {
  disciplina: null,
  plan: null,
  horarios: [],
  nombre: "",
  apellido: "",
  email: "",
  telefono: "",
  metodoPago: "en-escuela",
  nombreAlumna: "",
  apellidoAlumna: "",
};

function continuarEnabled(paso: number, estado: InscripcionState): boolean {
  if (paso === 1) return estado.disciplina !== null;
  if (paso === 2) return estado.plan !== null;
  if (paso === 3) return estado.horarios.length > 0;
  return false; // paso 4+ handled by component buttons
}

export default function Home() {
  const [paso, setPaso] = useState(1);
  const [estado, setEstado] = useState<InscripcionState>(estadoInicial);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [slots, setSlots] = useState<HorarioSlot[]>([]);
  const [cargando, setCargando] = useState(true);
  const [iscrizioneId, setIscrizioneId] = useState<string | null>(null);
  const [contattoId, setContattoId] = useState<string | null>(null);
  const [bozze, setBozze] = useState<BozzaIscrizione[]>([]);

  useEffect(() => {
    fetchDiscipline()
      .then(setDisciplinas)
      .finally(() => setCargando(false));
  }, []);

  const update = (updates: Partial<InscripcionState>) =>
    setEstado((e) => ({ ...e, ...updates }));

  const buildBozzaAttuale = (): BozzaIscrizione | null => {
    if (!estado.disciplina || !estado.plan || !disciplinaObj || !planObj) return null;
    return {
      disciplinaId: estado.disciplina,
      disciplinaNombre: disciplinaObj.nombre,
      planId: estado.plan,
      planNombre: planObj.nombre,
      planPrecio: planObj.precio,
      horarios: [...estado.horarios],
      esNinas: DISCIPLINAS_NINAS.has(estado.disciplina),
    };
  };

  const handleCrossSellContinuar = () => {
    const bozza = buildBozzaAttuale();
    if (!bozza) return;
    setBozze(prev => [...prev, bozza]);
    setPaso(5);
  };

  const handleCrossSellAgregar = () => {
    const bozza = buildBozzaAttuale();
    if (!bozza) return;
    setBozze(prev => [...prev, bozza]);
    setEstado(e => ({ ...e, disciplina: null, plan: null, horarios: [], nombreAlumna: "", apellidoAlumna: "" }));
    setPlanes([]);
    setSlots([]);
    setPaso(1);
  };

  const disciplinaObj = disciplinas.find((d) => d.id === estado.disciplina) ?? null;
  const planObj = planes.find((p) => p.id === estado.plan) ?? null;

  const handleDisciplinaSelect = async (id: DisciplinaId) => {
    update({ disciplina: id, plan: null, horarios: [] });
    setCargando(true);
    try {
      const [newPlanes, newSlots] = await Promise.all([
        fetchPiani(id),
        fetchOrari(id),
      ]);
      setPlanes(newPlanes);
      setSlots(newSlots);
      setPaso(2);
    } finally {
      setCargando(false);
    }
  };

  const handleContinuar = () => {
    if (paso < 4 && continuarEnabled(paso, estado)) setPaso(paso + 1);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#fff8f5", color: "#25190f" }}>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center px-5 py-3 border-b" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9" }}>
        <a
          href="https://andreacarriostudio.es/"
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
          style={{ color: "#89726c", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M11 6.5H2M5.5 3L2 6.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver a la web
        </a>
      </div>

      {/* Sidebar + content */}
      <div className="flex flex-1">
        <StepIndicator pasoActual={paso} />


        <main className="flex-1 min-w-0 py-8">
          {cargando && (
            <div className="flex items-center justify-center h-64">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "#7d2b13", borderTopColor: "transparent" }}
              />
            </div>
          )}

          {!cargando && paso === 1 && (
            <Paso1Disciplina
              disciplinas={disciplinas}
              value={estado.disciplina}
              onSelect={handleDisciplinaSelect}
            />
          )}

          {!cargando && paso === 2 && disciplinaObj && (
            <Paso2Plan
              disc={disciplinaObj}
              planes={planes}
              value={estado.plan}
              onSelect={(id: PlanId) => {
                update({ plan: id, horarios: [] });
                setPaso(3);
              }}
              onBack={() => setPaso(1)}
            />
          )}

          {!cargando && paso === 3 && disciplinaObj && planObj && (
            <Paso3Horarios
              disc={disciplinaObj}
              planInfo={planObj}
              slots={slots}
              value={estado.horarios}
              onChange={(horarios) => update({ horarios })}
              onContinuar={() => bozze.length > 0 ? handleCrossSellContinuar() : setPaso(4)}
              onBack={() => setPaso(2)}
            />
          )}

          {/* paso 4: cross-sell */}
          {paso === 4 && estado.disciplina && disciplinaObj && planObj && (
            <Paso4CrossSell
              disciplinaId={estado.disciplina}
              disciplinaNombre={disciplinaObj.nombre}
              planNombre={planObj.nombre}
              planPrecio={planObj.precio}
              bozzeExistentes={bozze}
              onContinuar={handleCrossSellContinuar}
              onAgregarOtra={handleCrossSellAgregar}
            />
          )}

          {/* paso 5: datos personales + confirm */}
          {paso === 5 && bozze.length > 0 && (
            <Paso4Pago
              estado={estado}
              bozze={bozze}
              onChange={update}
              onBack={() => setPaso(4)}
              existingContattoId={contattoId}
              onConfirmado={(cId, iId) => { setContattoId(cId); setIscrizioneId(iId); setPaso(6); }}
            />
          )}

          {/* paso 6: gracias */}
          {paso === 6 && iscrizioneId && bozze.length > 0 && (
            <Paso5Gracias
              iscrizioneId={iscrizioneId}
              disciplinaId={bozze[0].disciplinaId}
              nombre={estado.nombre}
            />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t py-8" style={{ borderColor: "#dcc1b9" }}>
        <div className="px-6 text-center">
          <p
            className="text-xs tracking-widest uppercase mb-3"
            style={{
              color: "#7d2b13",
              fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
              letterSpacing: "0.15em",
            }}
          >
            Andrea Carrió Studio — Alfahuir, Valencia
          </p>
          <div className="flex justify-center gap-6">
            {["Privacidad", "Términos", "Contacto"].map((link) => (
              <a
                key={link}
                href="#"
                className="text-xs tracking-widest uppercase transition-colors hover:opacity-80"
                style={{
                  color: "#89726c",
                  fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
                  letterSpacing: "0.1em",
                }}
              >
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
