import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { ingresosEntre } from "@/lib/ingresos-server";

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

// GET ?anio=YYYY → datos para el módulo de Impuestos:
//  · ingresos por trimestre (total / exento ballet-niñas / no exento con IVA)
//  · gasto mensual deducible (Costes sin la categoría "Andrea", que no desgrava)
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const anio = Number(req.nextUrl.searchParams.get("anio")) || new Date().getFullYear();

  const { lineas } = await ingresosEntre(`${anio}-01-01`, `${anio + 1}-01-01`);
  const trimestres = [0, 1, 2, 3].map(q => ({ q: q + 1, total: 0, exento: 0, noExento: 0 }));
  for (const l of lineas) {
    const mes = Number(l.fecha.split("-")[1]); // 1-12
    const qi = Math.min(3, Math.max(0, Math.floor((mes - 1) / 3)));
    trimestres[qi].total += l.importe;
    if (l.exento) trimestres[qi].exento += l.importe; else trimestres[qi].noExento += l.importe;
  }

  const { data: costes } = await supabaseAdmin.from("costes").select("categoria, importe_mensual");
  const suma = (pred: (cat: string) => boolean) =>
    (costes ?? []).filter(c => pred((c.categoria as string) || "")).reduce((s, c) => s + (Number(c.importe_mensual) || 0), 0);
  const costeMensualDeducible = suma(cat => cat !== "Andrea"); // "Andrea" (titular) no desgrava
  const costeMensualAndrea = suma(cat => cat === "Andrea");

  // Facturas de gastos deducibles por trimestre: IVA soportado (303) y base (130).
  const { data: facturas } = await supabaseAdmin.from("facturas").select("fecha, base, iva, deducible").gte("fecha", `${anio}-01-01`).lt("fecha", `${anio + 1}-01-01`);
  const facturasTrim = [0, 1, 2, 3].map(() => ({ iva: 0, base: 0 }));
  for (const f of facturas ?? []) {
    if (f.deducible === false || !f.fecha) continue;
    const mes = Number((f.fecha as string).split("-")[1]);
    const qi = Math.min(3, Math.max(0, Math.floor((mes - 1) / 3)));
    facturasTrim[qi].iva += Number(f.iva) || 0;
    facturasTrim[qi].base += Number(f.base) || 0;
  }

  return NextResponse.json({ anio, trimestres, costeMensualDeducible, costeMensualAndrea, facturasTrim });
}
