"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// Banner de consentimiento de cookies (RGPD). Google Analytics arranca en modo
// "denegado" (Consent Mode v2) y solo escribe cookies/medición si la visitante
// acepta. La decisión se recuerda en localStorage para no volver a preguntar.
export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const c = localStorage.getItem("cookie_consent");
    if (c === "granted") {
      window.gtag?.("consent", "update", { analytics_storage: "granted" });
    } else if (c !== "denied") {
      setShow(true);
    }
  }, []);

  const decide = (granted: boolean) => {
    localStorage.setItem("cookie_consent", granted ? "granted" : "denied");
    window.gtag?.("consent", "update", {
      analytics_storage: granted ? "granted" : "denied",
    });
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9999] p-2.5 sm:p-4"
      style={{ fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
    >
      <div
        className="mx-auto max-w-2xl rounded-xl shadow-lg px-4 py-3 sm:px-5 sm:py-4 flex flex-row items-center gap-3"
        style={{ backgroundColor: "#fff8f5", border: "1px solid #dcc1b9" }}
      >
        <p className="text-xs sm:text-sm leading-snug flex-1" style={{ color: "#56423d" }}>
          Uso cookies de analítica para mejorar la web.{" "}
          <a
            href="https://andreacarriostudio.es"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-70 whitespace-nowrap"
            style={{ color: "#7d2b13" }}
          >
            Más info
          </a>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => decide(false)}
            className="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ backgroundColor: "#f0e0d8", color: "#7d2b13" }}
          >
            Rechazar
          </button>
          <button
            onClick={() => decide(true)}
            className="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#7d2b13" }}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
