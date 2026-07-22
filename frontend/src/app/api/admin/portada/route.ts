import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 60;

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

const ACTIVIDAD: Record<string, string> = {
  pilates: "doing a graceful, controlled Pilates mat exercise on a mat",
  barre: "doing an elegant barre workout movement, with one hand resting on the wooden ballet barre",
  ballet: "in an elegant, graceful ballet pose next to the ballet barre",
};

function construirPrompt(disciplina: string): string {
  const act = ACTIVIDAD[disciplina] ?? "in an elegant, active pose";
  return `You are given several reference photos.
- The FIRST photo is THE PERSON. Keep this exact person: same face, same hair, same body shape, same height, same skin. Do NOT beautify, slim, age, or change them in any way. It must be unmistakably the same real person.
- The OTHER photos show the REAL dance & pilates studio where this must be set. Recreate THIS exact studio and its details: terracotta / salmon accent wall, cream walls, honey-toned wood laminate floor, wooden ballet barres mounted on the wall, a large wall mirror, and beige pilates stability balls on a light wooden shelf.
Create ONE realistic, editorial-style promotional photo of that exact person ${act}, inside that real studio.
Rules:
- Front view, with the face clearly visible. It must NOT be a side profile.
- Realistic and authentic, as if it were a real photo actually taken in that studio.
- Fitted activewear. Warm natural light, cozy premium atmosphere.
- Vertical 9:16 composition. Leave clean empty space at the top and at the bottom for text overlays.`;
}

// Nano Banana (Gemini). Modelo de imagen: barato y preserva la identidad.
const MODEL = "gemini-2.5-flash-image";

// Fotos reales del estudio (en /public) — se cargan una vez y se cachean.
const STUDIO_FILES = ["estudio-ref-1.jpg", "estudio-ref-2.jpg", "estudio-ref-3.jpg"];
let studioCache: { data: string; mimeType: string }[] | null = null;
async function getStudioRefs(base: string): Promise<{ data: string; mimeType: string }[]> {
  if (studioCache) return studioCache;
  const refs: { data: string; mimeType: string }[] = [];
  for (const name of STUDIO_FILES) {
    try {
      const r = await fetch(`${base}/${name}`);
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      refs.push({ data: buf.toString("base64"), mimeType: "image/jpeg" });
    } catch { /* si una falla, seguimos sin ella */ }
  }
  if (refs.length) studioCache = refs;
  return refs;
}

type Part = {
  text?: string;
  inlineData?: { data?: string; mimeType?: string };
  inline_data?: { data?: string; mime_type?: string };
};
type GeminiResp = {
  candidates?: { content?: { parts?: Part[] } }[];
  error?: { message?: string };
};

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "Falta GEMINI_API_KEY en el servidor." }, { status: 500 });

  const body = await req.json().catch(() => null);
  const imageBase64 = (body?.imageBase64 ?? "").toString();
  const mimeType = (body?.mimeType ?? "image/jpeg").toString();
  const disciplina = (body?.disciplina ?? "pilates").toString();
  if (!imageBase64) return NextResponse.json({ error: "Falta la foto." }, { status: 400 });

  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const studio = await getStudioRefs(base);

  const parts: Part[] = [
    { text: construirPrompt(disciplina) },
    { inlineData: { mimeType, data: imageBase64 } }, // la persona (primera)
    ...studio.map((s) => ({ inlineData: { mimeType: s.mimeType, data: s.data } })),
  ];

  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts }] }),
    });
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con Gemini." }, { status: 502 });
  }

  const data = (await res.json().catch(() => null)) as GeminiResp | null;
  if (!res.ok) {
    const msg = data?.error?.message || `Error ${res.status} de Gemini`;
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const outParts = data?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = outParts.find((p) => p?.inlineData?.data || p?.inline_data?.data);
  const out = imgPart?.inlineData?.data || imgPart?.inline_data?.data;
  if (!out) {
    const textPart = outParts.find((p) => p?.text)?.text;
    return NextResponse.json(
      { error: textPart ? `Gemini no devolvió imagen: ${textPart.slice(0, 200)}` : "Gemini no devolvió imagen. Prueba con otra foto (cara de frente y bien iluminada)." },
      { status: 502 },
    );
  }
  const outMime = imgPart?.inlineData?.mimeType || imgPart?.inline_data?.mime_type || "image/png";
  return NextResponse.json({ imageBase64: out, mimeType: outMime });
}
