import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 60;

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

const ACTIVIDAD: Record<string, string> = {
  pilates: "performing a calm, controlled Pilates mat exercise on a mat on the floor (for example a seated roll-up or a leg stretch), with good posture and engaged core",
  barre: "performing an elegant barre exercise, one hand resting lightly on the wooden ballet barre, standing tall with good posture",
  ballet: "holding an elegant, graceful ballet position beside the wooden ballet barre, with good posture and soft arms",
};

// Nano Banana Pro primero (mucho mejor preservando la identidad); si no estuviera
// disponible en la cuenta, cae al Nano Banana normal.
const MODELS = ["gemini-3-pro-image-preview", "gemini-2.5-flash-image"];

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
  error?: { message?: string; status?: string };
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

  const act = ACTIVIDAD[disciplina] ?? "in a calm, elegant active pose";
  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const studio = await getStudioRefs(base);

  const parts: Part[] = [
    {
      text:
`You are a professional photographer creating ONE promotional photograph for a real dance & pilates studio.

STEP 1 — STUDY THE PERSON.
Below ${persona.length > 1 ? `are ${persona.length} photos` : "is a photo"} of ONE specific REAL person. Study ${persona.length > 1 ? "them" : "it"} carefully before drawing anything. This is a real individual, NOT a character to invent and NOT a lookalike to approximate.`,
    },
    ...persona.map((i) => ({ inlineData: { mimeType: i.mime || "image/jpeg", data: i.data as string } })),
  ];

  if (studio.length) {
    parts.push({
      text:
`STEP 2 — STUDY THE PLACE.
These photos show the REAL studio where the photo must be taken. Reproduce this exact room: terracotta / salmon painted accent wall, cream walls, honey-toned wood laminate floor with visible planks, wooden ballet barres mounted on the wall at two heights with white brackets, a large floor-to-ceiling wall mirror, beige pilates stability balls stored in a light wooden shelf unit, white drop ceiling with square panels. Same colours, same light, same feel.`,
    });
    parts.push(...studio.map((s) => ({ inlineData: { mimeType: s.mimeType, data: s.data } })));
  }

  parts.push({
    text:
`STEP 3 — CREATE THE PHOTO.
Create ONE photorealistic vertical photograph of THAT EXACT PERSON, ${act}, inside THAT EXACT studio.

ABSOLUTE IDENTITY RULES — these matter more than beauty, style or composition:
- Reproduce the face with forensic accuracy: same face shape and jawline, same eyes (shape, spacing, colour, eyelids), same eyebrows, same nose (bridge, width, tip), same mouth and lips, same ears, same chin.
- Same hair exactly: colour, length, texture, curl pattern, hairline and styling.
- Same facial hair exactly (beard / stubble shape and density). If the person wears glasses, keep the same glasses shape and colour.
- Same skin tone and complexion, including moles, freckles and natural marks.
- Same apparent age, same body build, same height, same body proportions (shoulders, torso, arms, legs).
- DO NOT beautify. DO NOT slim or add muscle. DO NOT smooth or airbrush the skin. DO NOT make them younger, taller or more athletic. DO NOT change ethnicity or gender.
- Someone who knows this person must recognise them instantly. When in doubt, always choose fidelity to the reference photos over aesthetics.

PHOTOGRAPHIC REALISM:
- It must look like a REAL photo taken with a good camera in that room, not an AI render or a magazine retouch.
- Natural, realistic skin texture with pores and small imperfections. Natural warm indoor light matching the studio photos. Believable shadows on the floor.
- Simple, plain fitted activewear in neutral tones. Nothing flashy.

FRAMING:
- Vertical 9:16 format.
- The person seen from the FRONT, face fully visible and well lit. It must NOT be a side profile and the face must not be cropped or turned away.
- The person is the clear subject, centred, with the studio recognisable around them.
- Leave clean, uncluttered space at the TOP and at the BOTTOM of the frame, because text will be overlaid there afterwards.

Output: the photograph only.`,
  });

  let lastError = "";
  for (const model of MODELS) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ parts }] }),
      });
    } catch {
      lastError = "No se pudo conectar con Gemini.";
      continue;
    }

    const data = (await res.json().catch(() => null)) as GeminiResp | null;

    if (!res.ok) {
      const msg = data?.error?.message || `Error ${res.status} de Gemini`;
      lastError = msg;
      // Si el modelo no existe/no está disponible en la cuenta, probamos el siguiente.
      if (res.status === 404 || /not found|not supported|does not exist/i.test(msg)) continue;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const outParts = data?.candidates?.[0]?.content?.parts ?? [];
    const imgPart = outParts.find((p) => p?.inlineData?.data || p?.inline_data?.data);
    const out = imgPart?.inlineData?.data || imgPart?.inline_data?.data;
    if (out) {
      const outMime = imgPart?.inlineData?.mimeType || imgPart?.inline_data?.mime_type || "image/png";
      return NextResponse.json({ imageBase64: out, mimeType: outMime, modelo: model });
    }
    lastError = outParts.find((p) => p?.text)?.text?.slice(0, 200) || "Gemini no devolvió imagen.";
  }

  return NextResponse.json({ error: lastError || "No se pudo generar la imagen." }, { status: 502 });
}
