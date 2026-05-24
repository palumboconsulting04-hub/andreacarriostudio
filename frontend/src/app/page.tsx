"use client";

import { useState, useEffect } from "react";
import StepIndicator from "@/components/inscripcion/StepIndicator";
import Paso1Disciplina from "@/components/inscripcion/Paso1Disciplina";
import Paso2Plan from "@/components/inscripcion/Paso2Plan";
import Paso3Horarios from "@/components/inscripcion/Paso3Horarios";
import Paso4Pago from "@/components/inscripcion/Paso4Pago";
import type { InscripcionState, Disciplina, Plan, HorarioSlot, DisciplinaId, PlanId } from "@/components/inscripcion/types";
import { fetchDiscipline, fetchPiani, fetchOrari } from "@/lib/queries";

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
  if (paso === 4) return !!(estado.nombre && estado.apellido && estado.email);
  return false;
}

export default function Home() {
  const [paso, setPaso] = useState(1);
  const [estado, setEstado] = useState<InscripcionState>(estadoInicial);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [slots, setSlots] = useState<HorarioSlot[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetchDiscipline()
      .then(setDisciplinas)
      .finally(() => setCargando(false));
  }, []);

  const update = (updates: Partial<InscripcionState>) =>
    setEstado((e) => ({ ...e, ...updates }));

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

      {/* Sidebar + content */}
      <div className="flex flex-1">
        <StepIndicator
          pasoActual={paso}
          onContinuar={handleContinuar}
          continuarEnabled={continuarEnabled(paso, estado)}
        />

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
              onContinuar={() => setPaso(4)}
              onBack={() => setPaso(2)}
            />
          )}

          {paso === 4 && disciplinaObj && planObj && (
            <Paso4Pago
              estado={estado}
              disc={disciplinaObj}
              plan={planObj}
              onChange={update}
              onBack={() => setPaso(3)}
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
