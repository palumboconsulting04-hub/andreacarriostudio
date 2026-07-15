"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Posts tipográficos (sin foto) para que la alumna comparta en su Instagram Story
// con su código de "Trae a tu amiga". Genera una imagen 1080x1920 en Canvas y la
// comparte con navigator.share (mismo patrón que CompartirCodigo).
//
// AUTOCONTENIDO: para quitarlo, borra este archivo y la línea <PostsInstagram/>
// de MisClasesPanel. No toca base de datos ni APIs.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

const C = { burgundy: "#7d2b13", burgundy2: "#9c4228", blush: "#ffdbd1", cream: "#fff8f5", brown: "#56423d", dark: "#25190f" };
const linkDe = (codigo: string) => `https://reservas.andreacarriostudio.es/?ref=${codigo}&c=ig`;

type Plantilla = {
  id: string;
  etiqueta: string;
  fondo: string;   // color de fondo del preview
  texto: string;   // color del texto del preview
  frase: string[]; // líneas del preview
};

const PLANTILLAS: Plantilla[] = [
  { id: "frase", etiqueta: "Frase", fondo: C.burgundy, texto: C.cream, frase: ["Muévete.", "Respira.", "Vuelve a ti."] },
  { id: "logro", etiqueta: "Logro", fondo: C.blush, texto: C.burgundy, frase: ["Hoy me he", "cuidado 🤍"] },
  { id: "invita", etiqueta: "Invitación", fondo: C.burgundy2, texto: C.cream, frase: ["Te invito a", "probar conmigo"] },
];

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lineas(ctx: CanvasRenderingContext2D, arr: string[], x: number, y: number, lh: number, font: string, color: string) {
  ctx.font = font; ctx.fillStyle = color;
  arr.forEach((t, i) => ctx.fillText(t, x, y + i * lh));
}

// Genera la imagen del post según la plantilla. Fondo de color de marca + tipografía.
async function generar(id: string, codigo: string): Promise<Blob> {
  const W = 1080, H = 1920, cx = W / 2;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";

  const marca = (color: string) => {
    ctx.font = "700 34px 'Helvetica Neue', Arial, sans-serif";
    try { ctx.letterSpacing = "6px"; } catch {}
    ctx.fillStyle = color; ctx.fillText("ANDREA CARRIÓ STUDIO", cx, 150);
    try { ctx.letterSpacing = "1px"; } catch {}
    ctx.font = "28px 'Helvetica Neue', Arial, sans-serif";
    ctx.fillText("Danza & Pilates · Valencia", cx, 200);
    try { ctx.letterSpacing = "0px"; } catch {}
  };

  // Píldora con el código, abajo.
  const pildoraCodigo = (bg: string, fg: string) => {
    ctx.font = "700 44px 'Helvetica Neue', Arial, sans-serif";
    const label = `Mi código · ${codigo}`;
    const tw = ctx.measureText(label).width;
    const pw = tw + 90, ph = 116, px = cx - pw / 2, py = H - 300;
    ctx.fillStyle = bg; roundRect(ctx, px, py, pw, ph, 58); ctx.fill();
    ctx.fillStyle = fg; ctx.fillText(label, cx, py + 74);
    ctx.font = "30px 'Helvetica Neue', Arial, sans-serif";
    ctx.fillStyle = bg === "#ffffff" ? "rgba(255,255,255,0.85)" : "rgba(255,248,245,0.85)";
    ctx.fillText("reservas.andreacarriostudio.es", cx, H - 130);
  };

  if (id === "logro") {
    // Fondo blush→crema, texto burdeos.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.blush); g.addColorStop(1, C.cream);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    marca(C.burgundy);
    lineas(ctx, ["Hoy me he", "cuidado 🤍"], cx, 820, 140, "600 128px Georgia, 'Times New Roman', serif", C.burgundy);
    ctx.font = "40px 'Helvetica Neue', Arial, sans-serif"; ctx.fillStyle = C.brown;
    ctx.fillText("Barre & Pilates · mi rutina", cx, 1080);
    pildoraCodigo(C.burgundy, C.cream);
  } else if (id === "invita") {
    ctx.fillStyle = C.burgundy2; ctx.fillRect(0, 0, W, H);
    marca(C.cream);
    lineas(ctx, ["Te invito a", "probar una clase", "conmigo"], cx, 780, 150, "600 122px Georgia, 'Times New Roman', serif", C.cream);
    ctx.font = "42px 'Helvetica Neue', Arial, sans-serif"; ctx.fillStyle = C.blush;
    ctx.fillText("Un regalo para las dos 🤎", cx, 1250);
    pildoraCodigo("#ffffff", C.burgundy);
  } else {
    // frase (por defecto): fondo burdeos, texto crema.
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, C.burgundy); g.addColorStop(1, C.burgundy2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    marca(C.cream);
    lineas(ctx, ["Muévete.", "Respira.", "Vuelve a ti."], cx, 800, 168, "600 140px Georgia, 'Times New Roman', serif", C.cream);
    pildoraCodigo("#ffffff", C.burgundy);
  }

  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.92));
}

export default function PostsInstagram({ codigo }: { codigo: string }) {
  const [sel, setSel] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [generando, setGenerando] = useState(false);
  const [instrucciones, setInstrucciones] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Al elegir un post, generamos su imagen ya (para que el botón Compartir la tenga
  // lista y no se pierda el gesto al llamar a navigator.share).
  const elegir = async (id: string) => {
    setSel(id); setInstrucciones(false); setFile(null); setGenerando(true);
    try { setFile(new File([await generar(id, codigo)], `post-${id}.jpg`, { type: "image/jpeg" })); } catch {}
    setGenerando(false);
  };

  const compartir = async () => {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> };
    let ok = false;
    if (file && nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
      try { await nav.share({ files: [file] }); ok = true; } catch { /* cancelado */ }
    }
    if (!ok && file) { // fallback: descargar para subir a mano
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
    try { await navigator.clipboard.writeText(linkDe(codigo)); } catch {}
    setInstrucciones(true);
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(linkDe(codigo)); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch {}
  };

  return (
    <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.blush}` }}>
      <p className="text-sm font-bold mb-1" style={{ color: C.burgundy }}>Comparte un post en tu Story 🤎</p>
      <p className="text-xs mb-3" style={{ color: C.brown }}>Elige uno, ya lleva tu código. Lo compartes y, si una amiga se apunta, ganáis las dos.</p>

      <div className="grid grid-cols-3 gap-2">
        {PLANTILLAS.map(p => {
          const activo = sel === p.id;
          return (
            <button key={p.id} onClick={() => elegir(p.id)}
              className="rounded-xl overflow-hidden text-center transition-all"
              style={{ border: `2px solid ${activo ? C.burgundy : "transparent"}`, outline: "none" }}>
              <div className="flex flex-col items-center justify-center px-2" style={{ aspectRatio: "9/16", backgroundColor: p.fondo }}>
                {p.frase.map((f, i) => (
                  <span key={i} style={{ color: p.texto, fontFamily: "Georgia, serif", fontSize: 13, lineHeight: 1.15, fontWeight: 600 }}>{f}</span>
                ))}
                <span className="mt-1.5 px-1.5 py-0.5 rounded-full" style={{ fontSize: 8, fontWeight: 700, backgroundColor: "rgba(255,255,255,0.9)", color: C.burgundy }}>{codigo}</span>
              </div>
              <span className="block py-1.5 text-[11px] font-semibold" style={{ color: activo ? C.burgundy : "#89726c" }}>{p.etiqueta}</span>
            </button>
          );
        })}
      </div>

      {sel && (
        <div className="mt-3 flex flex-col gap-2">
          <button onClick={compartir} disabled={generando || !file}
            className="w-full py-3 rounded-full text-sm font-bold"
            style={{ backgroundColor: C.burgundy, color: C.cream, opacity: generando || !file ? 0.6 : 1 }}>
            {generando ? "Preparando tu post…" : "Compartir en mi Story"}
          </button>
          <button onClick={copiar} className="w-full py-2.5 rounded-full text-xs font-semibold" style={{ backgroundColor: "#fff0eb", color: C.burgundy, border: "1px solid #dcc1b9" }}>
            {copiado ? "¡Link copiado!" : "Copiar solo el link"}
          </button>
        </div>
      )}

      {instrucciones && (
        <div className="rounded-2xl p-4 mt-3 text-left" style={{ backgroundColor: "#fff6f2", border: `1px solid ${C.burgundy}` }}>
          <p className="text-sm font-bold mb-2" style={{ color: C.burgundy }}>Para tu Story 🤎</p>
          <ol className="text-xs space-y-1.5" style={{ color: C.brown, paddingLeft: "18px", listStyle: "decimal" }}>
            <li>Sube el post a tu Instagram Story.</li>
            <li>Toca el sticker <strong>“Enlace”</strong> y pega el link (ya lo he copiado por ti).</li>
            <li>¡Publica! Tu código va puesto: la amiga solo toca el enlace.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
