"use client";

import { useState } from "react";
import StepIndicator from "@/components/inscripcion/StepIndicator";
import Paso1Disciplina from "@/components/inscripcion/Paso1Disciplina";
import Paso2Plan from "@/components/inscripcion/Paso2Plan";
import Paso3Horarios from "@/components/inscripcion/Paso3Horarios";
import Paso4Pago from "@/components/inscripcion/Paso4Pago";
import type { InscripcionState } from "@/components/inscripcion/types";

const estadoInicial: InscripcionState = {
  disciplina: null,
  plan: null,
  horarios: [],
  nombre: "",
  apellido: "",
  email: "",
  telefono: "",
  metodoPago: "tarjeta",
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

  const update = (updates: Partial<InscripcionState>) =>
    setEstado((e) => ({ ...e, ...updates }));

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
          {paso === 1 && (
            <Paso1Disciplina
              value={estado.disciplina}
              onSelect={(id) => {
                update({ disciplina: id, plan: null, horarios: [] });
                setPaso(2);
              }}
            />
          )}

          {paso === 2 && estado.disciplina && (
            <Paso2Plan
              disciplina={estado.disciplina}
              value={estado.plan}
              onSelect={(id) => {
                update({ plan: id, horarios: [] });
                setPaso(3);
              }}
              onBack={() => setPaso(1)}
            />
          )}

          {paso === 3 && estado.disciplina && estado.plan && (
            <Paso3Horarios
              disciplina={estado.disciplina}
              plan={estado.plan}
              value={estado.horarios}
              onChange={(horarios) => update({ horarios })}
              onContinuar={() => setPaso(4)}
              onBack={() => setPaso(2)}
            />
          )}

          {paso === 4 && estado.disciplina && estado.plan && (
            <Paso4Pago
              estado={estado}
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
