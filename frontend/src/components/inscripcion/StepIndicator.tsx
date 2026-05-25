"use client";

import Image from "next/image";

const pasos = [
  {
    num: 1,
    label: "Disciplina",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2c1.5 0 2.5 1 2.5 2.5S13.5 7 12 7s-2.5-1-2.5-2.5S10.5 2 12 2z" />
        <path d="M12 7v5l-3 4m3-4l3 4" />
        <path d="M9 11l-3 2m9-2l3 2" />
      </svg>
    ),
  },
  {
    num: 2,
    label: "Plan",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="M8 14h4M8 18h6" />
      </svg>
    ),
  },
  {
    num: 3,
    label: "Horarios",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    num: 4,
    label: "Pago",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="13" rx="2" />
        <path d="M2 11h20" />
        <path d="M6 16h3" />
      </svg>
    ),
  },
];

interface Props {
  pasoActual: number;
}

export default function StepIndicator({ pasoActual }: Props) {
  const displayPaso = pasoActual <= 3 ? pasoActual : (pasoActual === 4 ? 3 : 4);

  return (
    <aside
      className="hidden md:flex flex-col w-64 shrink-0 border-r"
      style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9" }}
    >
      <div className="flex flex-col h-full px-7 py-8">
        {/* Logo */}
        <div className="mb-5">
          <Image
            src="/logo.png"
            alt="Andrea Carrió Studio"
            width={96}
            height={96}
            priority
          />
        </div>

        {/* Volver a la web */}
        <a
          href="https://andreacarriostudio.es/"
          className="flex items-center gap-1.5 text-xs mb-5 transition-opacity hover:opacity-70"
          style={{ color: "#89726c", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif", letterSpacing: "0.05em" }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M11 6.5H2M5.5 3L2 6.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver a la web
        </a>

        {/* Summary header */}
        <div className="mb-1">
          <h2
            className="text-xl font-semibold leading-tight"
            style={{ fontFamily: "var(--font-playfair)", color: "#7d2b13" }}
          >
            Resumen
          </h2>
          <p
            className="text-xs mt-1"
            style={{ color: "#89726c", fontFamily: "var(--font-body)" }}
          >
            Tu selección actual
          </p>
        </div>

        <div className="border-b my-5" style={{ borderColor: "#dcc1b9" }} />

        {/* Steps */}
        <nav className="flex flex-col gap-5 flex-1">
          {pasos.map((paso) => {
            const activo = paso.num === displayPaso;
            const completado = paso.num < displayPaso;
            const color = activo ? "#7d2b13" : completado ? "#9c4228" : "#b0958e";

            return (
              <div key={paso.num} className="flex items-center gap-3" style={{ color }}>
                <span className="shrink-0">{paso.icon}</span>
                <span
                  className={`text-sm ${activo ? "font-semibold" : "font-normal"}`}
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {paso.label}
                </span>
                {completado && (
                  <svg className="ml-auto shrink-0" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2.5 7l3 3 6-6"
                      stroke="#9c4228"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            );
          })}
        </nav>

      </div>
    </aside>
  );
}
