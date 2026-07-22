"use client";

// Herramienta (admin) para generar la "portada" promocional de una clienta:
// sube foto → Gemini la recrea haciendo su actividad en el estudio → Canvas
// pone la promo obligatoria (escuela + ubicación + CTA + código amigo).
// Se prueba aquí; luego se publicará en Mis clases.

import { useRef, useState, type ChangeEvent } from "react";

const C = { burgundy: "#7d2b13", cream: "#fff8f5", blush: "#ffdbd1", dark: "#25190f", brown: "#56423d", muted: "#89726c", border: "#dcc1b9" };

type Disc = "pilates" | "barre" | "ballet";
const DISCS: { id: Disc; label: string }[] = [
  { id: "pilates", label: "Pilates" },
  { id: "barre", label: "Barre" },
  { id: "ballet", label: "Ballet" },
];

// Redimensiona/comprime la foto subida para no mandar megas al servidor.
async function fotoABase64(file: File, max = 1280): Promise<{ data: string; mime: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("No se pudo leer la imagen"));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = cv.toDataURL("image/jpeg", 0.9);
    return { data: dataUrl.split(",")[1], mime: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Dibuja la imagen cubriendo el lienzo (como object-fit: cover).
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number) {
  const scale = Math.max(W / img.width, H / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

// Compone la portada final 1080x1920 con la foto de la IA + la promo.
async function componer(aiUrl: string, codigo: string): Promise<string> {
  const W = 1080, H = 1920;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("No se pudo cargar la imagen generada"));
    i.src = aiUrl;
  });
  try { await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready; } catch { /* fuentes por defecto */ }

  drawCover(ctx, img, W, H);

  const serif = "'Playfair Display', Georgia, serif";
  const sans = "'Montserrat', Arial, sans-serif";

  // Toda la promo va en una BANDA INFERIOR (zona segura): en Instagram Story el
  // perfil/logo tapa la parte de arriba, así que la marca se pone abajo, visible.
  const gBand = ctx.createLinearGradient(0, 1340, 0, 1600);
  gBand.addColorStop(0, "rgba(125,43,19,0)");
  gBand.addColorStop(1, "rgba(125,43,19,0.92)");
  ctx.fillStyle = gBand;
  ctx.fillRect(0, 1340, W, 300);
  ctx.fillStyle = "rgba(125,43,19,0.92)";
  ctx.fillRect(0, 1600, W, H - 1600);

  ctx.textAlign = "left";
  ctx.fillStyle = C.cream;
  ctx.font = `700 46px ${serif}`;
  ctx.fillText("ANDREA CARRIÓ STUDIO", 56, 1556);
  ctx.fillStyle = C.blush;
  ctx.font = `600 25px ${sans}`;
  ctx.fillText("Danza & Pilates · Valencia (Alfahuir)", 58, 1598);
  ctx.fillStyle = C.cream;
  ctx.font = `700 54px ${serif}`;
  ctx.fillText("VEN A PROBAR", 56, 1684);
  ctx.fillStyle = C.blush;
  ctx.font = `700 30px ${sans}`;
  ctx.fillText(`Reserva con mi código  →  ${codigo || "TU CÓDIGO"}`, 58, 1732);
  ctx.fillStyle = C.cream;
  ctx.font = `500 25px ${sans}`;
  ctx.fillText("andreacarriostudio.es", 58, 1774);

  return cv.toDataURL("image/png");
}

export default function PortadaTool() {
  const [fotos, setFotos] = useState<{ data: string; mime: string; preview: string }[]>([]);
  const [disciplina, setDisciplina] = useState<Disc>("pilates");
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(""); setResultado(null);
    try {
      const nuevas = await Promise.all(files.map(async (f) => {
        const { data, mime } = await fotoABase64(f);
        return { data, mime, preview: `data:${mime};base64,${data}` };
      }));
      setFotos((prev) => [...prev, ...nuevas].slice(0, 4));
    } catch {
      setError("No se pudo leer alguna foto. Prueba con otra.");
    }
    e.target.value = "";
  };

  const generar = async () => {
    if (fotos.length === 0 || cargando) return;
    setCargando(true); setError(""); setResultado(null);
    try {
      const res = await fetch("/api/admin/portada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagenes: fotos.map((f) => ({ data: f.data, mime: f.mime })), disciplina }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || "No se pudo generar."); return; }
      const aiUrl = `data:${d.mimeType || "image/png"};base64,${d.imageBase64}`;
      const final = await componer(aiUrl, codigo.trim().toUpperCase());
      setResultado(final);
    } catch {
      setError("No se pudo conectar. Inténtalo de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  const compartir = async () => {
    if (!resultado) return;
    const filename = `portada-${(nombre || "clienta").toLowerCase().replace(/\s+/g, "-")}.png`;
    try {
      const blob = await (await fetch(resultado)).blob();
      const file = new File([blob], filename, { type: "image/png" });
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file] });
        return;
      }
    } catch { /* cancelado o no soportado → descarga */ }
    const a = document.createElement("a");
    a.href = resultado; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const inputStyle = { border: `1.5px solid ${C.border}`, borderRadius: "12px", padding: "10px 14px", fontSize: "14px", color: C.dark, backgroundColor: "#fff", outline: "none", width: "100%" } as const;

  return (
    <div className="max-w-3xl">
      <h3 className="text-headline-md font-headline-md text-primary mb-1">Eres portada</h3>
      <p className="text-sm mb-5" style={{ color: C.muted }}>
        La clienta sube una foto → la IA la recrea <strong>haciendo su actividad en el estudio</strong> → se le pone la promo (escuela, dónde estamos, llamada a la acción y su código amigo). Aquí lo probamos.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Panel de controles */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: C.brown }}>1. Fotos de la clienta (varias)</label>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFile} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="w-full py-3 rounded-xl text-sm font-semibold" style={{ border: `1.5px dashed ${C.burgundy}`, color: C.burgundy, backgroundColor: "#fff6f2" }}>
              {fotos.length ? "Añadir más fotos" : "📷 Subir fotos (mejor varias)"}
            </button>
            {fotos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {fotos.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={f.preview} alt="" className="rounded-xl w-16 h-20 object-cover" style={{ border: `1px solid ${C.border}` }} />
                    <button onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center" style={{ backgroundColor: C.burgundy, color: C.cream }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] mt-1.5" style={{ color: C.muted }}>Sube 2-4 fotos de la misma persona: <strong>cara de frente</strong> + <strong>cuerpo entero</strong>. Cuantas más, más se parece.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: C.brown }}>2. Actividad</label>
            <div className="flex gap-2">
              {DISCS.map(d => (
                <button key={d.id} onClick={() => setDisciplina(d.id)} className="flex-1 py-2 rounded-xl text-sm font-semibold transition-colors"
                  style={{ backgroundColor: disciplina === d.id ? C.burgundy : "#fff", color: disciplina === d.id ? C.cream : C.brown, border: `1.5px solid ${disciplina === d.id ? C.burgundy : C.border}` }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: C.brown }}>3. Nombre y código amigo</label>
            <div className="flex flex-col gap-2">
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre (opcional)" style={inputStyle} />
              <input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Código amigo (p. ej. MARIA05)" style={inputStyle} />
            </div>
          </div>

          <button onClick={generar} disabled={fotos.length === 0 || cargando} className="mt-1 py-3 rounded-xl text-sm font-bold uppercase tracking-wider disabled:opacity-40" style={{ backgroundColor: C.burgundy, color: C.cream }}>
            {cargando ? "Generando… (10-20 s)" : "Generar portada"}
          </button>
          {error && <p className="text-sm" style={{ color: "#b71c1c" }}>{error}</p>}
          <p className="text-[11px]" style={{ color: C.muted }}>Solo adultas, con su consentimiento. La IA no cambia la cara ni el cuerpo; recrea el ambiente del estudio.</p>
        </div>

        {/* Resultado */}
        <div className="flex flex-col items-center justify-center rounded-2xl p-4" style={{ backgroundColor: "#faf3ef", border: `1px solid ${C.border}`, minHeight: 360 }}>
          {resultado ? (
            <>
              <img src={resultado} alt="Portada generada" className="rounded-xl w-full max-w-[280px]" style={{ border: `1px solid ${C.border}` }} />
              <button onClick={compartir} className="mt-3 py-2.5 px-6 rounded-full text-sm font-bold" style={{ backgroundColor: C.burgundy, color: C.cream }}>
                📲 Compartir en Instagram
              </button>
              <button onClick={() => { const a = document.createElement("a"); a.href = resultado; a.download = "portada.png"; a.click(); }} className="mt-1 text-xs" style={{ color: C.muted }}>o descargar la imagen</button>
            </>
          ) : (
            <p className="text-sm text-center" style={{ color: C.muted }}>{cargando ? "Creando la portada en el estudio…" : "La portada aparecerá aquí"}</p>
          )}
        </div>
      </div>
    </div>
  );
}
