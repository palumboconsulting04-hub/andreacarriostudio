import { NextResponse } from "next/server";
import { buildEmailHtml } from "@/app/api/send-confirmation/route";

export async function GET() {
  const html = buildEmailHtml({
    email: "ejemplo@gmail.com",
    nombre: "María",
    apellido: "García",
    inscripciones: [
      {
        disciplina: "Pilates Reformer",
        plan: "Plan Mensual",
        precio: 90,
        horarios: ["Martes 18:00 – 19:00", "Jueves 18:00 – 19:00"],
      },
    ],
    totalMensual: 90,
    matricula: 35,
    metodoPago: "en-escuela",
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
