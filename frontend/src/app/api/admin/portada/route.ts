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
type ImgIn = { data?: string; mime?: string };

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "Falta GEMINI_API_KEY en el servidor." }, { status: 500 });

  const body = await req.json().catch(() => null);
  const imagenes = (Array.isArray(body?.imagenes) ? body.imagenes : []) as ImgIn[];
  const persona = imagenes.filter((i) => typeof i?.data === "string" && i.data);
  const disciplina = (body?.disciplina ?? "pilates").toString();
  if (persona.length === 0) return NextResponse.json({ error: "Falta la foto de la persona." }, { status: 400 });

  const act = ACTIVIDAD[disciplina] ?? "in an elegant, active pose";
  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const studio = await getStudioRefs(base);

  // Se etiquetan los grupos con texto para que la IA sepa qué es la persona y qué el estudio.
  const parts: Part[] = [
    { text: `You will create ONE realistic, editorial promotional photo. First, here ${persona.length > 1 ? "are photos" : "is a photo"} of THE PERSON — this is the exact real person you must keep: same face, same hair, same body shape, same height, same skin. Do NOT beautify, slim, age or change them. It must be unmistakably the same person.` },
    ...persona.map((i) => ({ inlineData: { mimeType: i.mime || "image/jpeg", data: i.data as string } })),
  ];
  if (studio.length) {
    parts.push({ text: "Now, here are photos of the REAL studio. Recreate THIS exact studio and its details: terracotta / salmon accent wall, cream walls, honey-toned wood laminate floor, wooden ballet barres mounted on the wall, a large wall mirror, and beige pilates stability balls on a light wooden shelf." });
    parts.push(...studio.map((s) => ({ inlineData: { mimeType: s.mimeType, data: s.data } })));
  }
  parts.push({ text: `Now create ONE photo of that exact person ${act}, inside that real studio. Front view, with the face clearly visible — NOT a side profile. Keep the person unmistakably identical to the reference photos. Realistic and authentic, as if really photographed in that studio. Fitted activewear, warm natural light. Vertical 9:16, leave clean empty space at the top and at the bottom for text overlays.` });

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
