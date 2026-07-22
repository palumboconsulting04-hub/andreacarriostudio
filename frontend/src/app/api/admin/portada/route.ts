import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 60;

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

// Ambiente real del estudio (para que la IA lo recree fiel), y el movimiento por
// disciplina. Reglas duras: NO cambiar cara/cuerpo/estudio, cara de frente, real.
const STUDIO =
  "a cozy boutique dance and pilates studio with warm terracotta and cream walls, honey-toned wood laminate floor, a wooden ballet barre on the wall, a large wall mirror, tan stability balls on a wooden shelf, and soft warm natural light";

const ACTIVIDAD: Record<string, string> = {
  pilates: "doing a graceful, controlled Pilates mat exercise on a mat",
  barre: "doing an elegant barre workout movement, with one hand resting on the wooden ballet barre",
  ballet: "in an elegant, graceful ballet pose next to the ballet barre",
};

function construirPrompt(disciplina: string): string {
  const act = ACTIVIDAD[disciplina] ?? "in an elegant, active pose";
  return `Editorial magazine-style promotional photo of the SAME person shown in the reference image, ${act}, inside ${STUDIO}.
Very important rules:
- Keep the person's face and body EXACTLY the same and clearly recognizable. Do NOT beautify, slim, age, or change their face, hair or body. It must look like the real person.
- Show the person from the front, with the face clearly visible. It must NOT be a side profile.
- Keep it realistic and authentic, as if it were a real photo taken in this real studio.
- Fitted athletic / activewear. Warm natural light, premium cozy boutique atmosphere.
- Vertical 9:16 composition. Leave clean empty space at the top and at the bottom for text overlays.
Photorealistic, high quality.`;
}

// Nano Banana (Gemini). Modelo de imagen: barato y preserva la identidad.
const MODEL = "gemini-2.5-flash-image";

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

  const payload = {
    contents: [
      {
        parts: [
          { text: construirPrompt(disciplina) },
          { inlineData: { mimeType, data: imageBase64 } },
        ],
      },
    ],
  };

  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(payload),
    });
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con Gemini." }, { status: 502 });
  }

  const data = (await res.json().catch(() => null)) as GeminiResp | null;
  if (!res.ok) {
    const msg = data?.error?.message || `Error ${res.status} de Gemini`;
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p?.inlineData?.data || p?.inline_data?.data);
  const out = imgPart?.inlineData?.data || imgPart?.inline_data?.data;
  if (!out) {
    const textPart = parts.find((p) => p?.text)?.text;
    return NextResponse.json(
      { error: textPart ? `Gemini no devolvió imagen: ${textPart.slice(0, 200)}` : "Gemini no devolvió imagen. Prueba con otra foto (cara de frente y bien iluminada)." },
      { status: 502 },
    );
  }
  const outMime = imgPart?.inlineData?.mimeType || imgPart?.inline_data?.mime_type || "image/png";
  return NextResponse.json({ imageBase64: out, mimeType: outMime });
}
