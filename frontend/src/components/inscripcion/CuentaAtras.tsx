"use client";

import { useEffect, useState } from "react";
import { MATRICULA_OFERTA_HASTA } from "@/lib/oferta";

// Reloj de cuenta atrás hasta que sube la matrícula. Se auto-oculta si ya caducó
// (o hasta que monta en el cliente, para no romper la hidratación).
//   variant="barra" → fina y discreta, para los pasos del funnel (no invasiva).
//   variant="pago"  → protagonista, junto al precio en el paso de pago.

function restante(hasta: Date) {
  const ms = hasta.getTime() - Date.now();
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

const dd = (n: number) => String(n).padStart(2, "0");

export default function CuentaAtras({
  variant = "barra",
  hasta = MATRICULA_OFERTA_HASTA,
}: {
  variant?: "barra" | "pago";
  hasta?: Date;
}) {
  const [t, setT] = useState<ReturnType<typeof restante> | undefined>(undefined);

  useEffect(() => {
    const tick = () => setT(restante(hasta));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [hasta]);

  if (t === undefined || t === null) return null; // sin montar (SSR) o caducado

  if (variant === "barra") {
    // Discreta: una línea, sin segundos (no parpadea), scrollea con el contenido.
    const falta = `${t.d > 0 ? `${t.d}d ` : ""}${dd(t.h)}h ${dd(t.m)}m`;
    return (
      <div
        className="flex items-center justify-center gap-2 rounded-full px-3 py-1.5 mb-6 text-center"
        style={{ backgroundColor: "#fff1e9", border: "1px solid #f0d9cf" }}
      >
        <span className="text-xs" style={{ color: "#7d2b13" }}>
          ⏱ Matrícula <strong>35€</strong> — sube a 50€ en{" "}
          <strong className="tabular-nums">{falta}</strong>
        </span>
      </div>
    );
  }

  // variant "pago": con segundos, más presencia, junto al botón de pagar.
  return (
    <div
      className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5"
      style={{ backgroundColor: "#7d2b13", color: "#fff8f5" }}
    >
      <span className="text-sm font-semibold">⏱ El precio sube en</span>
      <span className="text-sm font-bold tabular-nums">
        {t.d > 0 ? `${t.d}d ` : ""}{dd(t.h)}h {dd(t.m)}m {dd(t.s)}s
      </span>
    </div>
  );
}
