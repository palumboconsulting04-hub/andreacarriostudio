"use client";

const pasos = [
  { num: 1, label: "Disciplina" },
  { num: 2, label: "Plan" },
  { num: 3, label: "Horarios" },
  { num: 4, label: "Pago" },
];

interface Props {
  pasoActual: number;
}

export default function StepIndicator({ pasoActual }: Props) {
  return (
    <div className="flex items-center justify-center gap-0 px-6 py-6">
      {pasos.map((paso, i) => {
        const activo = paso.num === pasoActual;
        const completado = paso.num < pasoActual;
        return (
          <div key={paso.num} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-body font-semibold transition-all duration-300 ${
                  completado
                    ? "bg-siena text-white"
                    : activo
                    ? "bg-siena-container text-white ring-4 ring-siena-pale"
                    : "bg-apricot text-outline"
                }`}
              >
                {completado ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  paso.num
                )}
              </div>
              <span
                className={`text-xs font-body tracking-widest uppercase hidden sm:block transition-colors duration-300 ${
                  activo ? "text-siena font-semibold" : completado ? "text-siena-container" : "text-outline"
                }`}
              >
                {paso.label}
              </span>
            </div>
            {i < pasos.length - 1 && (
              <div
                className={`w-16 sm:w-24 h-px mx-3 mb-6 transition-colors duration-500 ${
                  paso.num < pasoActual ? "bg-siena" : "bg-outline-light"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
