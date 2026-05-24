import type { Disciplina, Plan, HorarioSlot, DisciplinaId, PlanId } from "./types";

export const disciplinas: Disciplina[] = [
  {
    id: "pilates-mat",
    nombre: "Pilates Mat",
    descripcion: "Core, postura, flexibilidad y respiración. Un método de bajo impacto que trabaja la musculatura profunda y mejora la movilidad articular.",
    imagen: "https://lh3.googleusercontent.com/aida/ADBb0ugojefKfdgnG23qLdP5o5CTxaWkVEUqVO21OhjCuYJCHIH5loDmvuuyiwBxRuL4Jv0hHsO8hy3hevSQalHJXvQg_dval1uqZfHvdTiEGZUS4OD4BradwaMzC8mbv4TPVsreSOAf9lGslGrXxJrA5Wr3_TFhiM1vNM92nZGMV_tah1nAGlE9AI9YzMnf9fX5m8wtxz2Qfvu4bTbNTziZ_qR6Xhi9gLxbC9Yfdf5S2iS4ifKuYkz4JVp11Qs6",
  },
  {
    id: "barre-fit",
    nombre: "Barre Fit",
    descripcion: "Piernas definidas y glúteos trabajados. Combina la técnica del ballet con series de alta repetición que activan la musculatura de forma profunda.",
    imagen: "https://lh3.googleusercontent.com/aida-public/AB6AXuDz5OIBKM_u2ZlVPO98dZS592lm2WJUKjj0Dggs7uAeglwN_J88YCHwCVZvXb2KfpmG8ecAgMRz4kkHMNh0w-M8x6aueE7n15_6e-oHYVDf2dE8B0XrseMcztDMuJzx2EHWMpWyO9GdzVPxuu2QbovlNZKeXBSrNB2n5IvIgLCqMRsjWSkmAD9rSEHn1bC3l1_Gfcq55iEr-o-RfnGDW2zHVThkC4k0It6RROZh7tYDbZ1kdCiBqlD5yFS2VEAJ65dwjr9I5BWL7RRh",
  },
  {
    id: "pre-ballet",
    nombre: "Pre Ballet 2-6 años",
    descripcion: "Método pedagógico real adaptado a cada etapa desde los 3 años, con preparación oficial RAD y un enfoque en técnica y humanidad.",
    imagen: "/pre-ballet.png",
  },
  {
    id: "ballet-i",
    nombre: "Ballet I 7-9 años",
    descripcion: "Desarrollo de la técnica base y disciplina. Fomentamos la consciencia corporal y la expresión artística en un entorno inspirador.",
    imagen: "/ballet-i.png",
  },
  {
    id: "ballet-ii",
    nombre: "Ballet II 10-12 años",
    descripcion: "Perfeccionamiento técnico, fuerza y fluidez para jóvenes talentos.",
    imagen: "/ballet-ii.png",
    soloIntensivo: true,
  },
  {
    id: "ballet-adultos",
    nombre: "Ballet Adultos",
    descripcion: "Técnica clásica adaptada al cuerpo adulto: postura, coordinación y expresión en un ambiente cercano y sin presión.",
    imagen: "/ballet-adultos.png",
  },
];

export const planesBase: Plan[] = [
  {
    id: "basico",
    nombre: "Básico",
    precio: 50,
    sesionesPorSemana: 1,
    sesionesMes: 4,
    precioClase: "Menos de 13€ por clase",
    features: [
      "1 clase fija a la semana",
      "Elige tu disciplina",
      "Grupo reducido y cercano",
      "Para quien quiere empezar y no tiene tiempo",
    ],
  },
  {
    id: "avanzado",
    nombre: "Avanzado",
    precio: 70,
    sesionesPorSemana: 2,
    sesionesMes: 8,
    precioClase: "Menos de 9€ por clase",
    features: [
      "2 clases fijas a la semana",
      "Misma disciplina, doble progreso",
      "Grupo reducido y cercano",
      "La frecuencia perfecta para ver resultados",
    ],
    destacado: true,
  },
  {
    id: "intensivo",
    nombre: "Intensivo",
    precio: 90,
    sesionesPorSemana: 3,
    sesionesMes: 12,
    precioClase: "Menos de 8€ por clase",
    features: [
      "3 clases fijas a la semana",
      "Máxima transformación",
      "Resultados más rápidos",
      "Grupo reducido y cercano",
    ],
  },
];

export const planBallet2: Plan[] = [
  {
    id: "intensivo",
    nombre: "Intensivo",
    precio: 90,
    sesionesPorSemana: 2,
    sesionesMes: 8,
    precioClase: "Menos de 12€ por clase",
    features: [
      "2 clases de hora y media a la semana",
      "Máxima transformación",
      "Resultados más rápidos",
      "Grupo reducido y cercano",
    ],
    destacado: true,
  },
];

const planesSinIntensivo = planesBase.filter((p) => p.id !== "intensivo");

export function getPlanes(disciplinaId: DisciplinaId): Plan[] {
  if (disciplinaId === "ballet-ii") return planBallet2;
  if (disciplinaId === "ballet-i" || disciplinaId === "pre-ballet" || disciplinaId === "ballet-adultos")
    return planesSinIntensivo;
  return planesBase;
}

export function getMaxSlots(planId: PlanId): number {
  const map: Record<PlanId, number> = { basico: 1, avanzado: 2, intensivo: 3 };
  return map[planId];
}

const slots = (
  prefix: string,
  list: { dia: string; hora: string; horaFin: string; disponibles: number; total: number }[]
): HorarioSlot[] =>
  list.map((s, i) => ({ id: `${prefix}-${i}`, ...s }));

export const horariosPorDisciplina: Record<DisciplinaId, HorarioSlot[]> = {
  "pilates-mat": slots("pm", [
    { dia: "Lunes",     hora: "09:00", horaFin: "10:00", disponibles: 4,  total: 10 },
    { dia: "Lunes",     hora: "11:30", horaFin: "12:30", disponibles: 7,  total: 10 },
    { dia: "Lunes",     hora: "20:15", horaFin: "21:15", disponibles: 5,  total: 10 },
    { dia: "Martes",    hora: "10:15", horaFin: "11:15", disponibles: 3,  total: 10 },
    { dia: "Miércoles", hora: "09:00", horaFin: "10:00", disponibles: 6,  total: 10 },
    { dia: "Miércoles", hora: "11:30", horaFin: "12:30", disponibles: 2,  total: 10 },
    { dia: "Miércoles", hora: "20:15", horaFin: "21:15", disponibles: 8,  total: 10 },
    { dia: "Jueves",    hora: "10:15", horaFin: "11:15", disponibles: 0,  total: 10 },
    { dia: "Viernes",   hora: "09:00", horaFin: "10:00", disponibles: 5,  total: 10 },
    { dia: "Viernes",   hora: "11:30", horaFin: "12:30", disponibles: 9,  total: 10 },
  ]),
  "barre-fit": slots("bf", [
    { dia: "Lunes",     hora: "10:15", horaFin: "11:15", disponibles: 6,  total: 12 },
    { dia: "Martes",    hora: "09:00", horaFin: "10:00", disponibles: 4,  total: 12 },
    { dia: "Miércoles", hora: "10:15", horaFin: "11:15", disponibles: 3,  total: 12 },
    { dia: "Jueves",    hora: "09:00", horaFin: "10:00", disponibles: 8,  total: 12 },
    { dia: "Viernes",   hora: "10:15", horaFin: "11:15", disponibles: 11, total: 12 },
  ]),
  "pre-ballet": slots("pb", [
    { dia: "Lunes",     hora: "17:45", horaFin: "18:45", disponibles: 5,  total: 8 },
    { dia: "Miércoles", hora: "17:45", horaFin: "18:45", disponibles: 3,  total: 8 },
  ]),
  "ballet-i": slots("b1", [
    { dia: "Martes",    hora: "17:45", horaFin: "18:45", disponibles: 4,  total: 8 },
    { dia: "Jueves",    hora: "17:45", horaFin: "18:45", disponibles: 6,  total: 8 },
  ]),
  "ballet-ii": slots("b2", [
    { dia: "Martes",    hora: "19:00", horaFin: "20:30", disponibles: 2,  total: 6 },
    { dia: "Jueves",    hora: "19:00", horaFin: "20:30", disponibles: 4,  total: 6 },
  ]),
  "ballet-adultos": slots("ba", [
    { dia: "Lunes",     hora: "19:00", horaFin: "20:00", disponibles: 7,  total: 10 },
    { dia: "Miércoles", hora: "19:00", horaFin: "20:00", disponibles: 5,  total: 10 },
  ]),
};
