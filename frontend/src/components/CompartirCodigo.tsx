"use client";

import { useState } from "react";
import QRCode from "qrcode";

const C = { burgundy: "#7d2b13", cream: "#fff8f5", brown: "#56423d", muted: "#89726c", dark: "#25190f", bg: "#f5ede8" };

const linkDe = (codigo: string) => `https://reservas.andreacarriostudio.es/comprar-bono?ref=${codigo}`;
const textoDe = (codigo: string) => `¡Ven a probar una clase conmigo en Andrea Carrió Studio! Usa mi código ${codigo} y ganamos las dos un regalo: ${linkDe(codigo)}`;

// Genera una imagen 1080x1920 (formato Story) con el código y un QR escaneable.
async function generarImagenStory(codigo: string): Promise<Blob> {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const centro = W / 2;

  // Fondo
  ctx.fillStyle = "#f5ede8"; ctx.fillRect(0, 0, W, H);
  // Tarjeta
  const cardX = 70, cardY = 150, cardW = W - 140, cardH = H - 300, r = 48;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(cardX + r, cardY);
  ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + cardH, r);
  ctx.arcTo(cardX + cardW, cardY + cardH, cardX, cardY + cardH, r);
  ctx.arcTo(cardX, cardY + cardH, cardX, cardY, r);
  ctx.arcTo(cardX, cardY, cardX + cardW, cardY, r);
  ctx.closePath();
  ctx.fill();

  ctx.textAlign = "center";

  ctx.fillStyle = C.burgundy;
  ctx.font = "bold 40px 'Helvetica Neue', Arial, sans-serif";
  try { ctx.letterSpacing = "6px"; } catch {}
  ctx.fillText("ANDREA CARRIÓ STUDIO", centro, 330);
  try { ctx.letterSpacing = "0px"; } catch {}

  ctx.fillStyle = C.dark;
  ctx.font = "68px Georgia, 'Times New Roman', serif";
  ctx.fillText("Ven a entrenar", centro, 520);
  ctx.fillText("conmigo", centro, 605);

  ctx.fillStyle = C.brown;
  ctx.font = "40px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("y ganamos las dos un regalo", centro, 700);

  ctx.fillStyle = C.muted;
  ctx.font = "bold 34px 'Helvetica Neue', Arial, sans-serif";
  try { ctx.letterSpacing = "6px"; } catch {}
  ctx.fillText("TU CÓDIGO", centro, 850);
  try { ctx.letterSpacing = "0px"; } catch {}

  // Caja del código
  const boxW = 620, boxH = 150, boxX = centro - boxW / 2, boxY = 900, br = 28;
  ctx.strokeStyle = C.burgundy; ctx.lineWidth = 4; ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(boxX + br, boxY);
  ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + boxH, br);
  ctx.arcTo(boxX + boxW, boxY + boxH, boxX, boxY + boxH, br);
  ctx.arcTo(boxX, boxY + boxH, boxX, boxY, br);
  ctx.arcTo(boxX, boxY, boxX + boxW, boxY, br);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = C.burgundy;
  ctx.font = "bold 84px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(codigo, centro, boxY + 104);

  ctx.fillStyle = C.brown;
  ctx.font = "38px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("Escanea el QR o úsalo al reservar en", centro, 1180);
  ctx.fillStyle = C.burgundy;
  ctx.font = "bold 36px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("reservas.andreacarriostudio.es", centro, 1235);

  // QR
  const qrUrl = await QRCode.toDataURL(linkDe(codigo), { width: 400, margin: 1, color: { dark: "#7d2b13", light: "#ffffff" } });
  const qrImg = new Image();
  await new Promise<void>((res, rej) => { qrImg.onload = () => res(); qrImg.onerror = () => rej(); qrImg.src = qrUrl; });
  ctx.drawImage(qrImg, centro - 200, 1320, 400, 400);

  return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej()), "image/png"));
}

export default function CompartirCodigo({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  const [generando, setGenerando] = useState(false);

  const compartir = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try { await nav.share({ title: "Andrea Carrió Studio", text: textoDe(codigo), url: linkDe(codigo) }); } catch { /* cancelado */ }
    } else {
      copiar();
    }
  };

  const whatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(textoDe(codigo))}`, "_blank");

  const copiar = async () => {
    try { await navigator.clipboard.writeText(linkDe(codigo)); setCopiado(true); setTimeout(() => setCopiado(false), 1600); } catch { /* sin permiso */ }
  };

  const story = async () => {
    if (generando) return;
    setGenerando(true);
    try {
      const blob = await generarImagenStory(codigo);
      const file = new File([blob], `mi-codigo-${codigo}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> };
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        try { await nav.share({ files: [file], text: textoDe(codigo) }); } catch { /* cancelado */ }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = file.name; a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* nada */ } finally {
      setGenerando(false);
    }
  };

  const btn = { padding: "12px 16px", borderRadius: "9999px", fontSize: "13px", fontWeight: 700, cursor: "pointer", border: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" } as const;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button onClick={compartir} style={{ ...btn, backgroundColor: C.burgundy, color: C.cream, flex: "1 1 auto" }}>Compartir</button>
        <button onClick={whatsapp} style={{ ...btn, backgroundColor: "#25D366", color: "#fff" }}>WhatsApp</button>
        <button onClick={copiar} style={{ ...btn, backgroundColor: "#fff0eb", color: C.burgundy, border: `1px solid #dcc1b9` }}>{copiado ? "¡Copiado!" : "Copiar link"}</button>
      </div>
      <button onClick={story} disabled={generando} style={{ ...btn, backgroundColor: "#fff", color: C.burgundy, border: `1.5px solid ${C.burgundy}`, opacity: generando ? 0.6 : 1 }}>
        {generando ? "Preparando…" : "📸 Imagen para tu Story"}
      </button>
    </div>
  );
}
