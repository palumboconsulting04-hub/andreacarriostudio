"use client";

import { useState, useEffect } from "react";

const C = { burgundy: "#7d2b13", cream: "#fff8f5", brown: "#56423d", muted: "#89726c", dark: "#25190f" };

// El enlace lleva el código puesto: la amiga solo tiene que tocarlo (no teclea nada).
// El parámetro c= marca el canal (wa/ig/copy) para medir por dónde convierte mejor.
const linkDe = (codigo: string, canal = "") => `https://reservas.andreacarriostudio.es/comprar-bono?ref=${codigo}${canal ? `&c=${canal}` : ""}`;
const textoDe = (codigo: string, canal = "") =>
  `Te invito a probar una clase conmigo en Andrea Carrió Studio 🤎 Danza & Pilates en Valencia (zona Alfahuir). Toca mi enlace y ven: ganamos las dos un regalo 👉 ${linkDe(codigo, canal)}`;

// Dibuja texto con sombra para que se lea sobre la foto.
function texto(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, font: string, color: string, spacing = 0) {
  ctx.font = font;
  ctx.fillStyle = color;
  try { ctx.letterSpacing = `${spacing}px`; } catch {}
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 2;
  ctx.fillText(t, x, y);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  try { ctx.letterSpacing = "0px"; } catch {}
}

// Imagen 1080x1920 (Story) con la foto de Andrea de fondo + texto de marketing.
async function generarImagenStory(): Promise<Blob> {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const centro = W / 2;

  // Foto de fondo (mismo origen → sin problemas de CORS).
  const foto = new Image();
  await new Promise<void>((res) => { foto.onload = () => res(); foto.onerror = () => res(); foto.src = "/andrea.jpg"; });
  if (foto.width) {
    const scale = Math.max(W / foto.width, H / foto.height);
    const dw = foto.width * scale, dh = foto.height * scale;
    ctx.drawImage(foto, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = C.burgundy; ctx.fillRect(0, 0, W, H);
  }

  // Velo oscuro arriba y abajo para que el texto se lea.
  const gTop = ctx.createLinearGradient(0, 0, 0, 340);
  gTop.addColorStop(0, "rgba(37,25,15,0.55)"); gTop.addColorStop(1, "rgba(37,25,15,0)");
  ctx.fillStyle = gTop; ctx.fillRect(0, 0, W, 340);
  const gBot = ctx.createLinearGradient(0, H - 820, 0, H);
  gBot.addColorStop(0, "rgba(37,25,15,0)"); gBot.addColorStop(0.55, "rgba(37,25,15,0.75)"); gBot.addColorStop(1, "rgba(37,25,15,0.92)");
  ctx.fillStyle = gBot; ctx.fillRect(0, H - 820, W, 820);

  ctx.textAlign = "center";

  // Nombre completo arriba.
  texto(ctx, "ANDREA CARRIÓ STUDIO", centro, 150, "bold 42px 'Helvetica Neue', Arial, sans-serif", "#ffffff", 6);
  texto(ctx, "Danza & Pilates · Valencia (Alfahuir)", centro, 200, "30px 'Helvetica Neue', Arial, sans-serif", "#ffe9e0", 1);

  // Titular marketiniano abajo.
  texto(ctx, "Ven a probar", centro, H - 470, "80px Georgia, 'Times New Roman', serif", "#ffffff");
  texto(ctx, "una clase conmigo", centro, H - 380, "80px Georgia, 'Times New Roman', serif", "#ffffff");
  texto(ctx, "Tu primera clase te va a encantar 🤎", centro, H - 300, "36px 'Helvetica Neue', Arial, sans-serif", "#ffe9e0");

  // Píldora CTA hacia el enlace.
  const pw = 620, ph = 110, px = centro - pw / 2, py = H - 220, pr = 55;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(px + pr, py);
  ctx.arcTo(px + pw, py, px + pw, py + ph, pr);
  ctx.arcTo(px + pw, py + ph, px, py + ph, pr);
  ctx.arcTo(px, py + ph, px, py, pr);
  ctx.arcTo(px, py, px + pw, py, pr);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.burgundy;
  ctx.font = "bold 40px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("TOCA EL ENLACE PARA VENIR", centro, py + 70);

  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.9));
}

export default function CompartirCodigo({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [instrucciones, setInstrucciones] = useState(false);
  const [imgFile, setImgFile] = useState<File | null>(null);

  // Pre-generamos la imagen al cargar. Si se generase dentro del clic, el await pierde
  // el "gesto de usuario" y el compartir nativo de Instagram no se abre en muchos móviles.
  useEffect(() => {
    let cancel = false;
    generarImagenStory()
      .then((blob) => { if (!cancel) setImgFile(new File([blob], "andrea-carrio-studio.jpg", { type: "image/jpeg" })); })
      .catch(() => {});
    return () => { cancel = true; };
  }, []);

  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(textoDe(codigo, "wa"))}`, "_blank");

  const copiar = async () => {
    try { await navigator.clipboard.writeText(linkDe(codigo, "copy")); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch { /* sin permiso */ }
  };

  const instagram = async () => {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> };
    let file = imgFile;
    let compartido = false;
    // Con la foto ya lista, compartimos SIN awaits previos → conserva el gesto y abre
    // el menú de Instagram. Si aún no estuviera lista (raro), la generamos al momento.
    if (file && nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
      try { await nav.share({ files: [file] }); compartido = true; } catch { /* cancelado o bloqueado */ }
    }
    if (!compartido) {
      if (!file) {
        setGenerando(true);
        try { file = new File([await generarImagenStory()], "andrea-carrio-studio.jpg", { type: "image/jpeg" }); setImgFile(file); } catch {}
        setGenerando(false);
      }
      if (!compartido && file && nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        try { await nav.share({ files: [file] }); compartido = true; } catch {}
      }
      // Último recurso: descargar la foto para que la suban a mano.
      if (!compartido && file) {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      }
    }
    try { await navigator.clipboard.writeText(linkDe(codigo, "ig")); } catch {}
    setInstrucciones(true);
  };

  const btn = { padding: "14px 16px", borderRadius: "14px", fontSize: "14px", fontWeight: 700, cursor: "pointer", border: "none", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" } as const;

  return (
    <div className="flex flex-col gap-2.5">
      <button onClick={whatsapp} style={{ ...btn, backgroundColor: "#25D366", color: "#fff" }}>Enviar por WhatsApp</button>
      <button onClick={instagram} disabled={generando} style={{ ...btn, backgroundColor: C.burgundy, color: C.cream, opacity: generando ? 0.6 : 1 }}>
        {generando ? "Preparando tu foto…" : "Compartir en mi Instagram Story"}
      </button>
      <button onClick={copiar} style={{ ...btn, backgroundColor: "#fff0eb", color: C.burgundy, border: "1px solid #dcc1b9" }}>{copiado ? "¡Link copiado!" : "Copiar el link"}</button>

      {instrucciones && (
        <div className="rounded-2xl p-4 mt-1 text-left" style={{ backgroundColor: "#fff6f2", border: `1px solid ${C.burgundy}` }}>
          <p className="text-sm font-bold mb-2" style={{ color: C.burgundy }}>Para tu Story de Instagram 🤎</p>
          <ol className="text-xs space-y-1.5" style={{ color: C.brown, paddingLeft: "18px", listStyle: "decimal" }}>
            <li>Sube la foto a tu Instagram Story.</li>
            <li>Toca el sticker <strong>“Enlace”</strong> y pega el link (ya lo he copiado por ti).</li>
            <li>¡Publica! Tu amiga solo tiene que tocar el enlace, tu código va puesto.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
