"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const C = { burgundy: "#7d2b13", blush: "#ffdbd1", cream: "#fff8f5", bg: "#f5ede8", brown: "#56423d", muted: "#89726c", border: "#dcc1b9", dark: "#25190f" };
const fSerif = "var(--font-playfair), 'Playfair Display', Georgia, serif";
const fSans = "var(--font-montserrat), 'Montserrat', sans-serif";
const DISC: Record<string, string> = { "barre-fit": "Barre Fit", "pilates-mat": "Pilates Mat" };

type Bono = { nombre: string; email: string; disciplina_id: string; creditos_restantes: number; caduca: string; valido_desde: string | null };

export default function BonoGracias() {
  const params = useSearchParams();
  const [bono, setBono] = useState<Bono | null>(null);

  useEffect(() => {
    const sid = params.get("session_id");
    if (!sid) return;
    // Red de seguridad: confirma el bono aunque el webhook no llegue (idempotente).
    fetch("/api/confirm-bono", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sid }),
    })
      .then(r => r.json())
      .then(d => { if (d.bono) setBono(d.bono as Bono); })
      .catch(() => {});
  }, [params]);

  const creditos = bono?.creditos_restantes ?? 0;
  const disc = bono ? (DISC[bono.disciplina_id] ?? bono.disciplina_id) : "";
  const caducaStr = bono?.caduca ? new Date(bono.caduca + "T00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "";
  const panelUrl = bono?.email ? `/mis-clases?email=${encodeURIComponent(bono.email)}` : "/mis-clases";
  const porEmpezar = !!bono?.valido_desde && bono.valido_desde > new Date().toISOString().slice(0, 10);
  const inicioStr = bono?.valido_desde ? new Date(bono.valido_desde + "T00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" }) : "";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center" style={{ backgroundColor: C.bg }}>
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-8" style={{ backgroundColor: C.blush }}>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><path d="M7 18l8 8L29 10" stroke={C.burgundy} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>

      <h1 className="text-4xl sm:text-5xl mb-4" style={{ fontFamily: fSerif, color: C.burgundy }}>¡Gracias por tu compra!</h1>

      <p className="text-base max-w-md leading-relaxed mb-7" style={{ color: C.brown }}>
        {bono
          ? porEmpezar
            ? <>Tu bono de <strong>{creditos} {creditos === 1 ? "clase" : "clases"} de {disc}</strong> queda reservado y <strong>empieza el {inicioStr}</strong>. Podrás reservar tus clases a partir de esa fecha.</>
            : <>Tu bono de <strong>{creditos} {creditos === 1 ? "clase" : "clases"} de {disc}</strong> ya está activo{caducaStr ? <>, válido hasta el <strong>{caducaStr}</strong></> : ""}.</>
          : <>Tu bono ya está activo y listo para reservar.</>}
      </p>

      {/* Cómo entrar */}
      <div className="w-full max-w-md rounded-3xl p-6 mb-7 text-left" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.burgundy, fontFamily: fSans }}>Para reservar tus clases</p>
        <p className="text-sm leading-relaxed" style={{ color: C.brown }}>
          Entra en tu área <strong style={{ color: C.dark }}>Mis clases</strong> con:
        </p>
        <ul className="mt-2 space-y-1.5">
          <li className="flex items-start gap-2.5 text-sm" style={{ color: C.brown }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-[6px]" style={{ backgroundColor: C.burgundy }} />
            <span className="min-w-0 break-words">
              Tu correo{bono?.email ? <>: <strong className="break-all" style={{ color: C.dark }}>{bono.email}</strong></> : <> (el mismo con el que has pagado)</>}
            </span>
          </li>
          <li className="flex items-start gap-2.5 text-sm" style={{ color: C.brown }}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-[6px]" style={{ backgroundColor: C.burgundy }} />
            <span className="min-w-0 break-words">
              Tu nombre{bono?.nombre ? <>: <strong style={{ color: C.dark }}>{bono.nombre}</strong></> : ""}
            </span>
          </li>
        </ul>
      </div>

      <a href={panelUrl} className="inline-block px-8 py-4 rounded-full text-sm font-semibold uppercase tracking-widest" style={{ backgroundColor: C.burgundy, color: C.cream, fontFamily: fSans, letterSpacing: "0.08em", textDecoration: "none" }}>
        Entrar en Mis clases y reservar →
      </a>

      <p className="text-xs max-w-md leading-relaxed mt-6" style={{ color: C.muted }}>
        También te hemos enviado un email con tu bono y este acceso, por si quieres entrar más tarde.
      </p>
    </div>
  );
}
