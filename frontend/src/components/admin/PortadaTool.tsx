"use client";

// Herramienta (admin) "Eres portada": recorta a la persona de su foto (quita el
// fondo en el navegador, sin IA generativa → la persona queda IDÉNTICA) y la monta
// sobre una foto real del estudio + la promo (escuela, ubicación, CTA, código amigo).

import { useRef, useState, type ChangeEvent } from "react";

const C = { burgundy: "#7d2b13", cream: "#fff8f5", blush: "#ffdbd1", dark: "#25190f", brown: "#56423d", muted: "#89726c", border: "#dcc1b9" };

const FONDOS = [
  { src: "/estudio-ref-3.jpg", label: "Barra y pelotas" },
  { src: "/estudio-ref-2.jpg", label: "Espejo" },
  { src: "/estudio-ref-1.jpg", label: "Terracota" },
];

// Redimensiona la foto subida (mejor para el recorte).
async function fotoADataUrl(file: File, max = 1400): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await cargarImg(url);
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    cv.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return cv.toDataURL("image/jpeg", 0.92);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function cargarImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("No se pudo cargar la imagen"));
    i.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number) {
  const scale = Math.max(W / img.width, H / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

// Monta: fondo del estudio + persona recortada + promo (banda inferior).
async function componer(cutoutUrl: string, bgSrc: string, codigo: string): Promise<string> {
  const W = 1080, H = 1920;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  const [bg, persona] = await Promise.all([cargarImg(bgSrc), cargarImg(cutoutUrl)]);
  try { await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready; } catch { /* fuentes por defecto */ }

  drawCover(ctx, bg, W, H);

  // Persona: escalada, centrada, con los pies justo encima de la banda.
  const feetY = 1582;
  const targetH = 1360;
  let scale = targetH / persona.height;
  let w = persona.width * scale, h = targetH;
  const maxW = W * 0.96;
  if (w > maxW) { const s = maxW / w; w *= s; h *= s; }
  const x = (W - w) / 2;
  const y = feetY - h;

  // Sombra suave a los pies (para "asentar" a la persona).
  ctx.save();
  ctx.globalAlpha = 0.33;
  ctx.fillStyle = "#000";
  try { ctx.filter = "blur(18px)"; } catch { /* sin blur */ }
  ctx.beginPath();
  ctx.ellipse(W / 2, feetY - 6, Math.max(90, w * 0.30), 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.drawImage(persona, x, y, w, h);

  // Promo en banda inferior (zona segura de la Story de Instagram).
  const serif = "'Playfair Display', Georgia, serif";
  const sans = "'Montserrat', Arial, sans-serif";
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
  const [foto, setFoto] = useState<string | null>(null);
  const [bg, setBg] = useState(FONDOS[0].src);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(""); setResultado(null);
    try {
      setFoto(await fotoADataUrl(f));
    } catch {
      setError("No se pudo leer la foto. Prueba con otra.");
    }
    e.target.value = "";
  };

  const generar = async () => {
    if (!foto || cargando) return;
    setCargando(true); setError(""); setResultado(null);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(foto, { model: "isnet_fp16" });
      const cutoutUrl = URL.createObjectURL(blob);
      const final = await componer(cutoutUrl, bg, codigo.trim().toUpperCase());
      URL.revokeObjectURL(cutoutUrl);
      setResultado(final);
    } catch {
      setError("No se pudo recortar a la persona. Prueba con una foto donde se vea bien (buena luz, persona destacada).");
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
        Recorta a la persona de su foto (queda <strong>idéntica</strong>) y la monta en <strong>tu estudio real</strong> con la promo (escuela, dónde estamos, llamada a la acción y su código amigo).
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: C.brown }}>1. Foto de la clienta</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="w-full py-3 rounded-xl text-sm font-semibold" style={{ border: `1.5px dashed ${C.burgundy}`, color: C.burgundy, backgroundColor: "#fff6f2" }}>
              {foto ? "Cambiar foto" : "📷 Subir / hacer foto"}
            </button>
            {foto && <img src={foto} alt="" className="mt-2 rounded-xl w-24 h-32 object-cover" style={{ border: `1px solid ${C.border}` }} />}
            <p className="text-[11px] mt-1.5" style={{ color: C.muted }}>Mejor una foto de <strong>cuerpo o medio cuerpo</strong>, con la persona bien destacada del fondo.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: C.brown }}>2. Fondo del estudio</label>
            <div className="flex gap-2">
              {FONDOS.map(f => (
                <button key={f.src} onClick={() => setBg(f.src)} className="rounded-xl overflow-hidden" style={{ border: `2.5px solid ${bg === f.src ? C.burgundy : C.border}` }} title={f.label}>
                  <img src={f.src} alt={f.label} className="w-16 h-20 object-cover block" />
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

          <button onClick={generar} disabled={!foto || cargando} className="mt-1 py-3 rounded-xl text-sm font-bold uppercase tracking-wider disabled:opacity-40" style={{ backgroundColor: C.burgundy, color: C.cream }}>
            {cargando ? "Montando…" : "Crear portada"}
          </button>
          {error && <p className="text-sm" style={{ color: "#b71c1c" }}>{error}</p>}
          <p className="text-[11px]" style={{ color: C.muted }}>Solo adultas, con su consentimiento. La persona no se altera (es su foto real); solo se recorta y se pone en el estudio.</p>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl p-4" style={{ backgroundColor: "#faf3ef", border: `1px solid ${C.border}`, minHeight: 360 }}>
          {resultado ? (
            <>
              <img src={resultado} alt="Portada" className="rounded-xl w-full max-w-[280px]" style={{ border: `1px solid ${C.border}` }} />
              <button onClick={compartir} className="mt-3 py-2.5 px-6 rounded-full text-sm font-bold" style={{ backgroundColor: C.burgundy, color: C.cream }}>
                📲 Compartir en Instagram
              </button>
              <button onClick={() => { const a = document.createElement("a"); a.href = resultado; a.download = "portada.png"; a.click(); }} className="mt-1 text-xs" style={{ color: C.muted }}>o descargar la imagen</button>
            </>
          ) : (
            <p className="text-sm text-center" style={{ color: C.muted }}>{cargando ? "Recortando a la persona y montando en el estudio… (la 1ª vez tarda un poco, descarga el recortador)" : "La portada aparecerá aquí"}</p>
          )}
        </div>
      </div>
    </div>
  );
}
