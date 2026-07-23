"use client";

// Email marketing desde el admin: elige segmento, escribe, prueba y envía.
// Las listas son VIVAS: se recalculan al enviar, así que quien ya compró o se
// dio de baja nunca recibe publicidad.

import { useEffect, useState } from "react";

const C = { burgundy: "#7d2b13", cream: "#fff8f5", dark: "#25190f", brown: "#56423d", muted: "#89726c", border: "#dcc1b9" };

type Segmento = { id: string; nombre: string; descripcion: string; total: number };
type Campana = { id: string; created_at: string; segmento: string; asunto: string; enviados: number; fallidos: number };
type Contacto = { email: string; nombre: string; fuente: string };

export default function EmailTool() {
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [excluidos, setExcluidos] = useState(0);
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [sel, setSel] = useState<string>("");
  const [asunto, setAsunto] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [emailPrueba, setEmailPrueba] = useState("");
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [verContactos, setVerContactos] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [confirmar, setConfirmar] = useState(false);

  const cargar = () => {
    fetch("/api/admin/email-listas").then(r => r.json()).then(d => {
      setSegmentos(d.segmentos ?? []);
      setExcluidos(d.excluidos ?? 0);
      setCampanas(d.campanas ?? []);
      if (!sel && d.segmentos?.[0]) setSel(d.segmentos[0].id);
    }).catch(() => {});
  };
  useEffect(cargar, []); // eslint-disable-line react-hooks/exhaustive-deps

  const segActual = segmentos.find(s => s.id === sel);

  const verLista = async () => {
    if (!sel) return;
    const { contactos } = await fetch(`/api/admin/email-listas?segmento=${sel}`).then(r => r.json());
    setContactos(contactos ?? []);
    setVerContactos(true);
  };

  const enviar = async (prueba: boolean) => {
    if (cargando) return;
    setCargando(true); setMsg(""); setError("");
    try {
      const res = await fetch("/api/admin/email-enviar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segmento: sel, asunto, cuerpo, prueba, emailPrueba }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "No se pudo enviar."); return; }
      if (prueba) setMsg(`Prueba enviada a ${emailPrueba}. Míralo antes de mandarlo a todas.`);
      else {
        setMsg(`✅ Enviado a ${d.enviados} personas${d.fallidos ? ` · ${d.fallidos} fallidos` : ""}.`);
        setAsunto(""); setCuerpo(""); cargar();
      }
      setConfirmar(false);
    } catch {
      setError("Error de conexión.");
    } finally { setCargando(false); }
  };

  const input = { border: `1.5px solid ${C.border}`, borderRadius: "12px", padding: "10px 14px", fontSize: "14px", color: C.dark, backgroundColor: "#fff", outline: "none", width: "100%" } as const;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h3 className="text-headline-md font-headline-md text-primary">Email marketing</h3>
        <p className="text-sm mt-0.5" style={{ color: C.muted }}>
          Las listas se calculan al enviar: quien ya ha comprado o se dio de baja <strong>nunca</strong> recibe publicidad.
          {excluidos > 0 && <> Ahora mismo hay <strong>{excluidos}</strong> correos protegidos.</>}
        </p>
      </div>

      {/* Segmentos */}
      <div className="grid sm:grid-cols-3 gap-3">
        {segmentos.map(s => (
          <button key={s.id} onClick={() => { setSel(s.id); setVerContactos(false); }}
            className="text-left p-4 rounded-2xl border transition-shadow hover:shadow-md"
            style={{ borderColor: sel === s.id ? C.burgundy : C.border, backgroundColor: sel === s.id ? "#fff6f2" : "#fff", borderWidth: sel === s.id ? 2 : 1 }}>
            <p className="text-3xl font-bold" style={{ color: C.burgundy }}>{s.total}</p>
            <p className="text-sm font-semibold mt-1" style={{ color: C.dark }}>{s.nombre}</p>
            <p className="text-[11px] mt-1 leading-snug" style={{ color: C.muted }}>{s.descripcion}</p>
          </button>
        ))}
      </div>

      {segActual && (
        <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: C.border, backgroundColor: "#fff" }}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold" style={{ color: C.burgundy }}>
              Escribir a: {segActual.nombre} ({segActual.total} personas)
            </p>
            <button onClick={verLista} className="text-xs font-semibold" style={{ color: C.muted }}>Ver a quién →</button>
          </div>

          {verContactos && (
            <div className="rounded-xl border max-h-52 overflow-y-auto" style={{ borderColor: C.border }}>
              {contactos.map(c => (
                <div key={c.email} className="flex justify-between gap-3 px-3 py-1.5 text-xs border-b last:border-b-0" style={{ borderColor: "#f0e4de" }}>
                  <span style={{ color: C.dark }}>{c.nombre || "—"}</span>
                  <span style={{ color: C.muted }}>{c.email}</span>
                </div>
              ))}
            </div>
          )}

          <input value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Asunto del correo" style={input} />
          <textarea value={cuerpo} onChange={e => setCuerpo(e.target.value)} rows={8}
            placeholder={"Escribe aquí tu mensaje.\n\nDeja una línea en blanco entre párrafos.\nSe añade solo el saludo con su nombre, tu firma y el enlace de baja."}
            style={{ ...input, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }} />

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <input value={emailPrueba} onChange={e => setEmailPrueba(e.target.value)} placeholder="tu@email.com" style={{ ...input, maxWidth: 240 }} />
            <button onClick={() => enviar(true)} disabled={cargando || !asunto || !cuerpo || !emailPrueba}
              className="py-2.5 px-4 rounded-xl text-sm font-semibold border disabled:opacity-40 shrink-0"
              style={{ borderColor: C.burgundy, color: C.burgundy }}>
              Enviarme una prueba
            </button>
          </div>

          {!confirmar ? (
            <button onClick={() => setConfirmar(true)} disabled={cargando || !asunto || !cuerpo}
              className="w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider disabled:opacity-40"
              style={{ backgroundColor: C.burgundy, color: C.cream }}>
              Enviar a las {segActual.total} personas
            </button>
          ) : (
            <div className="rounded-xl p-3" style={{ backgroundColor: "#fde7e7" }}>
              <p className="text-sm mb-2" style={{ color: "#b71c1c" }}>
                ¿Seguro? Se enviará a <strong>{segActual.total} personas</strong> y no se puede deshacer.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmar(false)} disabled={cargando} className="flex-1 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: C.border, color: C.muted, backgroundColor: "#fff" }}>No, volver</button>
                <button onClick={() => enviar(false)} disabled={cargando} className="flex-1 py-2 rounded-lg text-sm font-bold" style={{ backgroundColor: "#b71c1c", color: "#fff" }}>
                  {cargando ? "Enviando…" : "Sí, enviar"}
                </button>
              </div>
            </div>
          )}

          {msg && <p className="text-sm" style={{ color: "#1f7a3d" }}>{msg}</p>}
          {error && <p className="text-sm" style={{ color: "#b71c1c" }}>{error}</p>}
        </div>
      )}

      {campanas.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: C.muted }}>Últimos envíos</p>
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: C.border }}>
            {campanas.map(c => (
              <div key={c.id} className="flex justify-between gap-3 px-4 py-2.5 text-xs border-b last:border-b-0" style={{ borderColor: "#f0e4de", backgroundColor: "#fff" }}>
                <span style={{ color: C.dark }}>{c.asunto}</span>
                <span style={{ color: C.muted }}>{new Date(c.created_at).toLocaleDateString("es-ES")} · {c.enviados} enviados</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
