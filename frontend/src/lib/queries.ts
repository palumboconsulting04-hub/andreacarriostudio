import { supabase } from "./supabase";
import type { Disciplina, Plan, HorarioSlot, DisciplinaId, PlanId } from "@/components/inscripcion/types";

// Static content not stored in DB
const DESCRIPCIONES: Record<string, string> = {
  "pilates-mat": "Core, postura y flexibilidad. Bajo impacto, resultados reales.",
  "barre-fit": "Ballet y fuerza en una sola clase. Piernas, glúteos y técnica.",
  "pre-ballet": "Ritmo y conciencia corporal desde los 3 años.",
  "ballet-i": "Danza clásica con método y exámenes RAD.",
  "ballet-ii": "Mayor exigencia técnica con metodología RAD.",
  "ballet-adultos": "Para quien empieza o retoma el ballet.",
};

const SOLO_INTENSIVO = new Set(["ballet-ii"]);

const DISCIPLINA_ORDER = ["barre-fit", "pilates-mat", "ballet-adultos", "pre-ballet", "ballet-i", "ballet-ii"];

const DIA_ORDER = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function buildPrecioClase(prezzo: number, classi: number): string {
  const perClass = prezzo / (classi * 4);
  return `Menos de ${Math.ceil(perClass)}€ por clase`;
}

function buildFeatures(id: string, classi: number, durata: number): string[] {
  const durStr = durata === 90 ? " de hora y media" : "";
  const line1 = `${classi} clase${classi > 1 ? "s" : ""}${durStr} fija${classi > 1 ? "s" : ""} a la semana`;
  if (id === "basico") return [line1, "Elige tu disciplina", "Grupo reducido y cercano", "Para quien quiere empezar y no tiene tiempo"];
  if (id === "avanzado") return [line1, "Misma disciplina, doble progreso", "Grupo reducido y cercano", "La frecuencia perfecta para ver resultados"];
  return [line1, "Máxima transformación", "Resultados más rápidos", "Grupo reducido y cercano"];
}

export async function fetchDiscipline(): Promise<Disciplina[]> {
  const { data, error } = await supabase
    .from("discipline")
    .select("id, nome, immagine_url")
    .eq("attiva", true);

  if (error) throw error;

  return (data ?? [])
    .map((d) => ({
      id: d.id as DisciplinaId,
      nombre: d.nome,
      imagen: d.immagine_url ?? "",
      descripcion: DESCRIPCIONES[d.id] ?? "",
      soloIntensivo: SOLO_INTENSIVO.has(d.id),
    }))
    .sort((a, b) => {
      const iA = DISCIPLINA_ORDER.indexOf(a.id);
      const iB = DISCIPLINA_ORDER.indexOf(b.id);
      return (iA === -1 ? 999 : iA) - (iB === -1 ? 999 : iB);
    });
}

export async function fetchPiani(disciplinaId: string): Promise<Plan[]> {
  const { data, error } = await supabase
    .from("piani")
    .select("id, nome, classi_settimana, durata_minuti, prezzo, popolare")
    .eq("disciplina_id", disciplinaId);

  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: p.id as PlanId,
    nombre: p.nome,
    precio: p.prezzo,
    sesionesPorSemana: p.classi_settimana,
    sesionesMes: p.classi_settimana * 4,
    destacado: p.popolare ?? false,
    precioClase: buildPrecioClase(p.prezzo, p.classi_settimana),
    features: buildFeatures(p.id, p.classi_settimana, p.durata_minuti),
  }));
}

export async function fetchOrari(disciplinaId: string): Promise<HorarioSlot[]> {
  const { data, error } = await supabase
    .from("orari")
    .select("id, giorno, ora_inizio, ora_fine, posti_totali, iscrizione_orari(orario_id)")
    .eq("disciplina_id", disciplinaId)
    .eq("attivo", true);

  if (error) throw error;

  const slots: HorarioSlot[] = (data ?? []).map((o) => ({
    id: o.id,
    dia: o.giorno,
    hora: (o.ora_inizio as string).substring(0, 5),
    horaFin: (o.ora_fine as string).substring(0, 5),
    total: o.posti_totali,
    disponibles: Math.max(0, o.posti_totali - ((o.iscrizione_orari as { orario_id: string }[])?.length ?? 0)),
  }));

  return slots.sort((a, b) => {
    const dA = DIA_ORDER.indexOf(a.dia);
    const dB = DIA_ORDER.indexOf(b.dia);
    if (dA !== dB) return dA - dB;
    return a.hora.localeCompare(b.hora);
  });
}

// Nota: la creación de contacto + inscripción + horarios se hace en el servidor
// (src/app/api/inscripcion/route.ts) con service-role, no desde el navegador.

export interface ProfiloMarketing {
  iscrizione_id: string;
  come_ci_hai_conosciuto?: string;
  red_social?: string;
  // Adulti
  motivazione?: string;
  fascia_eta?: string;
  esperienza_previa?: boolean;
  // Bambine
  eta_figlia?: string;
  esperienza_previa_figlia?: boolean;
  obiettivo_figlia?: string;
}

export async function submitProfiloMarketing(profilo: ProfiloMarketing): Promise<void> {
  const { error } = await supabase.from("profilo_marketing").insert(profilo);
  if (error) throw error;
}
