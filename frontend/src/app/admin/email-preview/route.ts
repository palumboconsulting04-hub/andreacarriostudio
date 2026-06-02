import { NextRequest, NextResponse } from "next/server";
import { buildEmailHtml } from "@/app/api/send-confirmation/route";

// Previsualización del email. Por defecto el flujo de tarjeta (suscripción).
// Para ver el del alta manual: /admin/email-preview?metodo=en-escuela
export async function GET(req: NextRequest) {
  const metodoPago = req.nextUrl.searchParams.get("metodo") ?? "tarjeta";
  const html = buildEmailHtml({
    email: "ejemplo@gmail.com",
    nombre: "María",
    apellido: "García",
    inscripciones: [
      {
        disciplina: "Ballet Adultas",
        plan: "Plan Mensual",
        precio: 50,
        horarios: ["Martes 18:00 – 19:00", "Jueves 18:00 – 19:00"],
      },
    ],
    totalMensual: 50,
    matricula: 35,
    metodoPago,
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
