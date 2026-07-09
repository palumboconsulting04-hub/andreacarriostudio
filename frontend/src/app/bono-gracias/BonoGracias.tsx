"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const C = { burgundy: "#7d2b13", blush: "#ffdbd1", bg: "#f5ede8", brown: "#56423d" };
const fSerif = "var(--font-playfair), 'Playfair Display', Georgia, serif";
const fSans = "var(--font-montserrat), 'Montserrat', sans-serif";

export default function BonoGracias() {
  const params = useSearchParams();

  useEffect(() => {
    const sid = params.get("session_id");
    if (!sid) return;
    // Red de seguridad: confirma el bono aunque el webhook no llegue (idempotente).
    fetch("/api/confirm-bono", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sid }),
    }).catch(() => {});
  }, [params]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center" style={{ backgroundColor: C.bg }}>
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-8" style={{ backgroundColor: C.blush }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><path d="M7 18l8 8L29 10" stroke={C.burgundy} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <h1 className="text-4xl sm:text-5xl mb-5" style={{ fontFamily: fSerif, color: C.burgundy }}>¡Bono comprado! 🤎</h1>
      <p className="text-base max-w-md leading-relaxed mb-2" style={{ color: C.brown }}>
        Te hemos enviado un <strong>email</strong> con tu bono y el acceso a tu panel.
      </p>
      <p className="text-sm max-w-md leading-relaxed mb-8" style={{ color: C.brown }}>
        Para reservar tus clases, entra en tu panel con el <strong>mismo correo</strong> con el que has pagado.
      </p>
      <a href="/mis-clases" className="inline-block px-8 py-4 rounded-full text-sm font-semibold uppercase tracking-widest" style={{ backgroundColor: C.burgundy, color: "#fff8f5", fontFamily: fSans, letterSpacing: "0.08em", textDecoration: "none" }}>
        Reservar mis clases →
      </a>
    </div>
  );
}
