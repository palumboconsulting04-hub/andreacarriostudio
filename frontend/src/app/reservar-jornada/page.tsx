"use client";

import { useState, useEffect } from "react";
import { SLOTS, EVENTO, slotById } from "@/lib/jornada";

const C = {
  burgundy: "#7d2b13", blush: "#ffdbd1", cream: "#fff8f5", bg: "#f5ede8",
  brown: "#56423d", dark: "#25190f", muted: "#89726c", border: "#dcc1b9",
};
const fSerif = "var(--font-playfair), 'Playfair Display', Georgia, serif";
const fSans = "var(--font-montserrat), 'Montserrat', sans-serif";

type Disp = { id: string; ocupadas: number; libres: number };

export default function ReservarJornada() {
  const [nombre, setNombre] = useState("");
  const [nombreMadre, setNombreMadre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [slotId, setSlotId] = useState("");
  const [disp, setDisp] = useState<Record<string, Disp>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [esEspera, setEsEspera] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const cargar = () => {
    fetch("/api/reservar-jornada")
      .then(r => r.json())
      .then(({ slots }) => {
        const m: Record<string, Disp> = {};
        for (const s of (slots ?? []) as Disp[]) m[s.id] = s;
        setDisp(m);
      })
      .catch(() => {});
  };
  useEffect(cargar, []);

  const emailOk = /\S+@\S+\.\S+/.test(email.trim());
  // En un turno de niña, "nombre" es la niña y además pedimos el de la madre/padre.
  const esNina = !!slotId && slotById(slotId)?.bloque === "ninas";
  const formValido = !!(nombre.trim() && telefono.trim() && emailOk && slotId && (!esNina || nombreMadre.trim()));
  // Si el turno elegido está lleno → la acción es apuntarse a su lista de espera.
  const selFull = !!slotId && !!disp[slotId] && disp[slotId].libres <= 0;

  const handleSubmit = async () => {
    if (!formValido || enviando) return;
    setEnviando(true);
    setErrorMsg("");
    const endpoint = selFull ? "/api/lista-espera-jornada" : "/api/reservar-jornada";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), telefono: telefono.trim(), email: email.trim(), slot_id: slotId, nombre_madre: esNina ? nombreMadre.trim() : "" }),
      });
      if (res.status === 409) {
        // El turno se llenó justo ahora: recargamos para que aparezca como COMPLETO.
        setErrorMsg("Esa hora se acaba de llenar. Vuelve a pulsarla para apuntarte a su lista de espera 👇");
        cargar();
        return;
      }
      if (!res.ok) throw new Error();
      setEsEspera(selFull);
      setEnviado(true);
    } catch {
      setErrorMsg("Ha habido un problema. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    const s = slotById(slotId);
    if (esEspera) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center" style={{ backgroundColor: C.bg }}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-8 text-4xl" style={{ backgroundColor: C.blush }}>⏳</div>
          <h2 className="text-4xl sm:text-5xl mb-5" style={{ fontFamily: fSerif, color: C.burgundy }}>¡Estás en la lista!</h2>
          <p className="text-base max-w-md leading-relaxed mb-2" style={{ color: C.brown }}>
            Esa hora está completa, pero te he apuntado a su lista de espera:
          </p>
          {s && <p className="text-lg font-bold mb-8" style={{ color: C.burgundy, fontFamily: fSans }}>{s.titulo} · {s.hora}</p>}
          <p className="text-sm max-w-md leading-relaxed" style={{ color: C.brown }}>
            Si abro otra clase a esa hora, serás de las primeras en saberlo 💕<br /><strong>Andrea</strong>
          </p>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center" style={{ backgroundColor: C.bg }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-8" style={{ backgroundColor: C.blush }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><path d="M7 18l8 8L29 10" stroke={C.burgundy} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        {esNina ? (
          <>
            <h2 className="text-3xl sm:text-4xl mb-5" style={{ fontFamily: fSerif, color: C.burgundy }}>¡Plaza reservada! 🩰</h2>
            <div className="max-w-lg text-left rounded-3xl p-6 sm:p-7" style={{ backgroundColor: "#ffffff", border: `1px solid ${C.border}` }}>
              <p className="text-base font-bold mb-3" style={{ color: C.burgundy, fontFamily: fSerif }}>¡Hola! 🤎</p>
              <p className="text-sm leading-relaxed mb-3" style={{ color: C.brown }}>¡Muchísimas gracias por confirmar la asistencia de <strong>{nombre}</strong> a las Jornadas de Puertas Abiertas de Andrea Carrió Studio!</p>
              <p className="text-sm leading-relaxed mb-3" style={{ color: C.brown }}>Me hace muchísima ilusión que pueda acompañarnos ese día y conocer el estudio.</p>
              <div className="rounded-2xl px-4 py-3 mb-4" style={{ backgroundColor: C.blush }}>
                <p className="text-sm font-semibold" style={{ color: C.burgundy }}>📅 Fecha: Jueves 24 de julio</p>
                <p className="text-sm font-semibold" style={{ color: C.burgundy }}>⏰ Horario: {s?.hora}</p>
              </div>
              <p className="text-sm font-bold mb-1.5" style={{ color: C.dark }}>¿Qué necesita traer?</p>
              <p className="text-sm leading-relaxed mb-1" style={{ color: C.brown }}>🩰 Ropa cómoda con la que pueda moverse con facilidad.</p>
              <p className="text-sm leading-relaxed mb-1" style={{ color: C.brown }}>🩰 Si tiene zapatillas de ballet, puede traerlas. Si no, no os preocupéis, podrá realizar la clase con calcetines.</p>
              <p className="text-sm leading-relaxed mb-4" style={{ color: C.brown }}>💧 Una botellita de agua.</p>
              <p className="text-sm leading-relaxed mb-3" style={{ color: C.brown }}>Mientras las niñas disfrutan de la clase, podréis esperar tranquilamente en la recepción. Al finalizar tendremos un ratito para conocernos, enseñaros el estudio, resolver cualquier duda sobre el próximo curso y compartir un pequeño detalle preparado con mucho cariño.</p>
              <p className="text-sm leading-relaxed mb-3" style={{ color: C.brown }}>Si finalmente no pudierais asistir, os agradecería muchísimo que me avisarais con la mayor antelación posible para poder ofrecer esa plaza a otra niña.</p>
              <p className="text-sm leading-relaxed mb-4" style={{ color: C.brown }}>¡Tengo muchísimas ganas de conoceros y daros la bienvenida a Andrea Carrió Studio! 🤎</p>
              <p className="text-sm font-semibold" style={{ color: C.burgundy }}>Andrea Carrió</p>
              <a href="https://wa.me/34614679291" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold" style={{ color: "#1f7a3d" }}>📱 WhatsApp 614679291</a>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-4xl sm:text-5xl mb-5" style={{ fontFamily: fSerif, color: C.burgundy }}>¡Hora reservada!</h2>
            <p className="text-base max-w-md leading-relaxed mb-2" style={{ color: C.brown }}>Te esperamos el <strong>{EVENTO.fecha}</strong>:</p>
            {s && <p className="text-lg font-bold mb-8" style={{ color: C.burgundy, fontFamily: fSans }}>{s.titulo} · {s.hora}</p>}
            <p className="text-sm max-w-md leading-relaxed" style={{ color: C.brown }}>
              Si quieres probar también la otra disciplina, puedes reservar otra hora.<br />¡Nos vemos! <strong>Andrea</strong>
            </p>
          </>
        )}
      </div>
    );
  }

  const bloque = (titulo: string, sub: string, ids: string[]) => (
    <div className="mb-6">
      <p className="text-sm font-bold mb-1" style={{ color: C.burgundy, fontFamily: fSans }}>{titulo}</p>
      {sub && <p className="text-xs mb-3" style={{ color: C.muted }}>{sub}</p>}
      <div className="flex flex-col gap-2.5">
        {ids.map(id => {
          const s = slotById(id)!;
          const d = disp[id];
          const libres = d ? d.libres : s.tope;
          const lleno = libres <= 0;
          const sel = slotId === id;
          return (
            <button
              key={id}
              onClick={() => setSlotId(id)}
              className="w-full text-left rounded-2xl px-4 py-3 transition-all flex items-center justify-between"
              style={{
                border: `2px solid ${sel ? C.burgundy : C.border}`,
                backgroundColor: sel ? (lleno ? "#fde7e7" : C.blush) : (lleno ? "#faf1ee" : C.cream),
                outline: "none", cursor: "pointer",
              }}
            >
              <span>
                <span className="block text-sm font-semibold" style={{ color: sel ? C.burgundy : C.dark, fontFamily: fSans }}>{s.titulo}</span>
                <span className="block text-xs" style={{ color: C.muted }}>{s.hora}</span>
              </span>
              <span className="text-xs font-semibold" style={{ color: lleno ? "#b71c1c" : "#1f7a3d" }}>
                {lleno ? "COMPLETO · espera" : `${libres} libres`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const inputStyle = { border: `1.5px solid ${C.border}`, borderRadius: "12px", padding: "12px 16px", fontSize: "16px", fontFamily: fSans, color: C.dark, backgroundColor: C.cream, outline: "none", width: "100%" };

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh" }} className="px-4 py-10">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl sm:text-4xl text-center mb-1" style={{ fontFamily: fSerif, color: C.burgundy }}>{EVENTO.titulo}</h1>
        <p className="text-center text-sm mb-1" style={{ color: C.dark, fontFamily: fSans, fontWeight: 600 }}>{EVENTO.fecha} · Valencia (Zona Alfahuir)</p>
        <p className="text-center text-sm mb-7" style={{ color: C.muted }}>Elige tu hora. Si está completa, te apuntas a su lista de espera 👇</p>

        <div className="rounded-3xl p-6 shadow-sm mb-5" style={{ backgroundColor: "#ffffff", border: `1px solid ${C.border}` }}>
          {bloque("🌅 NIÑAS · Mañana", "Clases de prueba de ballet para peques.", ["nin-pre", "nin-ballet-1", "nin-ballet-2"])}
          {bloque("🌆 ADULTAS · Tarde", "", ["adu-barre-1", "adu-pilates", "adu-barre-2"])}
        </div>

        <div className="rounded-3xl p-6 shadow-sm space-y-3" style={{ backgroundColor: "#ffffff", border: `2px solid ${C.burgundy}` }}>
          {esNina ? (
            <>
              <input style={inputStyle} placeholder="Nombre de la niña *" value={nombre} onChange={e => setNombre(e.target.value)} />
              <input style={inputStyle} placeholder="Tu nombre (madre/padre) *" value={nombreMadre} onChange={e => setNombreMadre(e.target.value)} />
            </>
          ) : (
            <input style={inputStyle} placeholder="Tu nombre *" value={nombre} onChange={e => setNombre(e.target.value)} />
          )}
          <input style={inputStyle} placeholder="WhatsApp *" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} />
          <input style={inputStyle} placeholder="Email *" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <p className="text-xs" style={{ color: C.muted }}>* Todos los campos son obligatorios</p>
          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
          {selFull && !errorMsg && (
            <p className="text-xs" style={{ color: C.burgundy }}>Esta hora está completa → te apuntarás a su <strong>lista de espera</strong>.</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={!formValido || enviando}
            className="w-full py-4 rounded-2xl text-sm font-semibold uppercase tracking-widest transition-all"
            style={{ backgroundColor: formValido ? C.burgundy : C.border, color: "#fff8f5", fontFamily: fSans, letterSpacing: "0.08em", cursor: formValido ? "pointer" : "not-allowed", opacity: enviando ? 0.7 : 1 }}
          >
            {enviando ? "Enviando..." : !slotId ? "Elige una hora arriba" : selFull ? "Apuntarme a la lista de espera" : "Reservar esta hora"}
          </button>
        </div>

        {/* Preguntas frecuentes (plegable, para no distraer de reservar) */}
        <div className="mt-7">
          <p className="text-sm font-bold mb-3 text-center" style={{ color: C.burgundy, fontFamily: fSans }}>Preguntas frecuentes</p>
          <div className="space-y-2">
            {[
              ["¿Para quién es esta jornada?", "Para las que os estáis planteando de verdad empezar en septiembre y queréis probar y conocer el estudio antes de decidir. Si es tu caso, este es tu día 💛"],
              ["¿Es gratis?", "Sí, totalmente. Vienes, pruebas tu clase y conoces el estudio, sin pagar nada."],
              ["¿Cuánto dura?", "Una horita: la clase de prueba más un ratito de picoteo y charla."],
              ["¿Qué llevo?", "Solo ropa cómoda. El material lo tengo yo listo en el estudio."],
              ["¿Y si no encuentro hueco en mi hora?", "Apúntate a la lista de espera de esa hora y te aviso en cuanto abra otra."],
              ["¿Tengo que apuntarme ese día?", "Para nada, sin compromiso. Y si te encaja, tendrás una oferta especial para dejar tu plaza."],
              ["¿Dónde es?", "En Calle Motilla del Palancar 34, en la zona de Alfahuir (Valencia), a 5 minutos del Centro Comercial Arena."],
            ].map(([q, a]) => (
              <details key={q} className="rounded-2xl px-4 py-3" style={{ backgroundColor: "#ffffff", border: `1px solid ${C.border}` }}>
                <summary className="cursor-pointer text-sm font-semibold flex justify-between items-center gap-2" style={{ color: C.burgundy, fontFamily: fSans, listStyle: "none" }}>
                  {q}
                  <span style={{ color: C.muted, fontSize: "0.7rem" }}>▼</span>
                </summary>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: C.brown }}>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
