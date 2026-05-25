import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages, studioData } = await req.json();

    const systemPrompt = `Eres Sofía 💎, la asistente inteligente de Andrea Carrió Studio, una escuela de danza en España.

Tu rol es ayudar a Andrea, la directora y propietaria, con consejos empresariales personalizados basados en los datos reales de su escuela.

DATOS ACTUALES DEL ESTUDIO:
- Total alumnas inscritas: ${studioData.iscrittiCount}
- Facturación este mes: ${studioData.facturacionMes}€
- Facturación mes anterior: ${studioData.facturacionMesAnterior}€
- Pagos pendientes: ${studioData.pendingCount} alumnas (${studioData.pendingAmount}€)
- Ocupación media de clases: ${studioData.ocupacionMedia}%
- Nuevas inscripciones este mes: ${studioData.nuevasInscripcionesMes}
- Costes fijos mensuales: ${studioData.finanzasCosteMensual}€
- Objetivo facturación este mes: ${studioData.objetivoFacturacion}€ (${studioData.objetivoProgress}% conseguido)
- Objetivo alumnas este mes: ${studioData.objetivoAlumnos} (ticket medio ${studioData.avgPricePerStudent}€)
- Resultado del mes (ingresos - costes): ${studioData.finResultadoMes}€

OCUPACIÓN POR DISCIPLINA:
${studioData.ocupacionDisciplinas.map((d: { nombre: string; ocupados: number; total: number }) => `- ${d.nombre}: ${d.ocupados}/${d.total} plazas (${d.total > 0 ? Math.round((d.ocupados / d.total) * 100) : 0}%)`).join("\n")}

INSTRUCCIONES:
- Responde siempre en español
- Sé concisa, directa y práctica — Andrea es una profesora de danza, no una experta en negocios
- Da consejos accionables (qué hacer exactamente, no teoría)
- Usa un tono cercano y motivador
- Si te preguntan algo que no está en los datos, dilo claramente
- Máximo 3-4 frases por respuesta salvo que se pida más detalle`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json({ reply: text });
  } catch (err) {
    console.error("Sofia error:", err);
    return NextResponse.json({ error: "Error al conectar con Sofía" }, { status: 500 });
  }
}
