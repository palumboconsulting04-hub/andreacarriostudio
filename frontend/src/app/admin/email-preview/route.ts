import { NextRequest, NextResponse } from "next/server";
import { buildEmailHtml } from "@/app/api/send-confirmation/route";
import { buildBonoEmailHtml } from "@/lib/bonos-server";

// Previsualización de los correos que reciben las clientas, con datos de ejemplo.
//   /admin/email-preview                    → mensualidad (flujo tarjeta)
//   /admin/email-preview?metodo=en-escuela  → mensualidad (alta manual)
//   /admin/email-preview?tipo=bono          → bono
export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get("tipo") ?? "mensualidad";

  let html: string;
  if (tipo === "bono") {
    html = buildBonoEmailHtml(
      { nombre: "María", email: "ejemplo@gmail.com", disciplina_id: "barre-fit", precio: "75" },
      5,
      new Date("2026-12-01T00:00:00"),
      "2026-09-01",
      false,
    );
  } else {
    const metodoPago = req.nextUrl.searchParams.get("metodo") ?? "tarjeta";
    html = buildEmailHtml({
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
  }

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
