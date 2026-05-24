import type { Disciplina, Plan, HorarioSlot, DisciplinaId, PlanId } from "./types";

export const disciplinas: Disciplina[] = [
  {
    id: "pilates-suelo",
    nombre: "Pilates Suelo",
    descripcion: "Control, respiración y fluidez. Fortalece tu core con ejercicios de mat.",
    emoji: "🧘‍♀️",
    gradientFrom: "#fce4d3",
    gradientTo: "#ffdbd1",
  },
  {
    id: "pilates-reformer",
    nombre: "Pilates Reformer",
    descripcion: "Entrenamiento en máquina reformer. Mayor resistencia, tonificación y control.",
    emoji: "⚡",
    gradientFrom: "#fff1e9",
    gradientTo: "#fce4d3",
  },
  {
    id: "barre",
    nombre: "Barre Fitness",
    descripcion: "La fusión de ballet, pilates y yoga. Moldea y define tu cuerpo con gracia.",
    emoji: "🩰",
    gradientFrom: "#ffdbd1",
    gradientTo: "#ffb5a0",
  },
  {
    id: "ballet-i",
    nombre: "Ballet Clásico I",
    descripcion: "Iniciación e intermedio. Técnica, expresión artística y elegancia en movimiento.",
    emoji: "🌸",
    gradientFrom: "#f6dece",
    gradientTo: "#fce4d3",
  },
  {
    id: "ballet-ii",
    nombre: "Ballet Clásico II",
    descripcion: "Nivel avanzado con formación intensiva. Incluye acceso a ensayos y actuaciones.",
    emoji: "👑",
    gradientFrom: "#9c4228",
    gradientTo: "#7d2b13",
    soloIntensivo: true,
  },
  {
    id: "stretch",
    nombre: "Stretch & Movilidad",
    descripcion: "Mejora tu flexibilidad, libera tensiones y recupera el equilibrio corporal.",
    emoji: "🌿",
    gradientFrom: "#fff8f5",
    gradientTo: "#fff1e9",
  },
];

export const planesBase: Plan[] = [
  {
    id: "basico",
    nombre: "Básico",
    precio: 50,
    sesionesPorSemana: 1,
    sesionesMes: 4,
    features: [
      "4 clases por mes",
      "1 clase semanal",
      "Acceso a la app del estudio",
    ],
  },
  {
    id: "avanzado",
    nombre: "Avanzado",
    precio: 70,
    sesionesPorSemana: 2,
    sesionesMes: 8,
    features: [
      "8 clases por mes",
      "2 clases semanales",
      "Acceso a la app del estudio",
      "Material de clase incluido",
    ],
    destacado: true,
  },
  {
    id: "intensivo",
    nombre: "Intensivo",
    precio: 90,
    sesionesPorSemana: 3,
    sesionesMes: 12,
    features: [
      "12 clases por mes",
      "3 clases semanales",
      "Acceso a la app del estudio",
      "Material de clase incluido",
      "Evaluación mensual personalizada",
    ],
  },
];

export const planBallet2: Plan[] = [
  {
    id: "intensivo",
    nombre: "Intensivo",
    precio: 90,
    sesionesPorSemana: 3,
    sesionesMes: 12,
    features: [
      "12 clases por mes",
      "3 clases semanales",
      "Material de clase incluido",
      "Evaluación mensual personalizada",
      "Zapatillas de punta incluidas",
      "Acceso a ensayos y actuaciones",
    ],
    destacado: true,
  },
];

export function getPlanes(disciplinaId: DisciplinaId): Plan[] {
  if (disciplinaId === "ballet-ii") return planBallet2;
  return planesBase;
}

export function getMaxSlots(planId: PlanId): number {
  const map: Record<PlanId, number> = { basico: 1, avanzado: 2, intensivo: 3 };
  return map[planId];
}

const slots = (
  prefix: string,
  list: { dia: string; hora: string; disponibles: number; total: number }[]
): HorarioSlot[] =>
  list.map((s, i) => ({ id: `${prefix}-${i}`, ...s }));

export const horariosPorDisciplina: Record<DisciplinaId, HorarioSlot[]> = {
  "pilates-suelo": slots("ps", [
    { dia: "Lunes",     hora: "09:00", disponibles: 3,  total: 10 },
    { dia: "Lunes",     hora: "18:30", disponibles: 8,  total: 10 },
    { dia: "Martes",    hora: "10:00", disponibles: 0,  total: 10 },
    { dia: "Miércoles", hora: "09:00", disponibles: 5,  total: 10 },
    { dia: "Miércoles", hora: "18:30", disponibles: 2,  total: 10 },
    { dia: "Jueves",    hora: "10:00", disponibles: 7,  total: 10 },
    { dia: "Viernes",   hora: "09:00", disponibles: 1,  total: 10 },
    { dia: "Viernes",   hora: "19:00", disponibles: 9,  total: 10 },
    { dia: "Sábado",    hora: "10:00", disponibles: 4,  total: 10 },
  ]),
  "pilates-reformer": slots("pr", [
    { dia: "Lunes",     hora: "09:00", disponibles: 2,  total: 6 },
    { dia: "Lunes",     hora: "17:00", disponibles: 0,  total: 6 },
    { dia: "Martes",    hora: "09:00", disponibles: 4,  total: 6 },
    { dia: "Miércoles", hora: "18:00", disponibles: 1,  total: 6 },
    { dia: "Jueves",    hora: "09:00", disponibles: 3,  total: 6 },
    { dia: "Jueves",    hora: "19:00", disponibles: 5,  total: 6 },
    { dia: "Viernes",   hora: "10:00", disponibles: 2,  total: 6 },
    { dia: "Sábado",    hora: "09:30", disponibles: 6,  total: 6 },
  ]),
  barre: slots("ba", [
    { dia: "Lunes",     hora: "10:00", disponibles: 6,  total: 12 },
    { dia: "Lunes",     hora: "19:30", disponibles: 0,  total: 12 },
    { dia: "Martes",    hora: "09:00", disponibles: 9,  total: 12 },
    { dia: "Miércoles", hora: "10:00", disponibles: 3,  total: 12 },
    { dia: "Jueves",    hora: "18:30", disponibles: 11, total: 12 },
    { dia: "Viernes",   hora: "09:00", disponibles: 5,  total: 12 },
    { dia: "Viernes",   hora: "19:00", disponibles: 0,  total: 12 },
    { dia: "Sábado",    hora: "10:00", disponibles: 8,  total: 12 },
    { dia: "Sábado",    hora: "11:30", disponibles: 12, total: 12 },
  ]),
  "ballet-i": slots("b1", [
    { dia: "Lunes",     hora: "18:00", disponibles: 5,  total: 10 },
    { dia: "Martes",    hora: "17:30", disponibles: 0,  total: 10 },
    { dia: "Miércoles", hora: "18:00", disponibles: 3,  total: 10 },
    { dia: "Jueves",    hora: "17:30", disponibles: 7,  total: 10 },
    { dia: "Viernes",   hora: "18:00", disponibles: 2,  total: 10 },
    { dia: "Sábado",    hora: "09:00", disponibles: 8,  total: 10 },
    { dia: "Sábado",    hora: "11:00", disponibles: 1,  total: 10 },
  ]),
  "ballet-ii": slots("b2", [
    { dia: "Lunes",     hora: "19:00", disponibles: 4,  total: 8 },
    { dia: "Miércoles", hora: "19:00", disponibles: 0,  total: 8 },
    { dia: "Jueves",    hora: "19:30", disponibles: 2,  total: 8 },
    { dia: "Viernes",   hora: "19:00", disponibles: 6,  total: 8 },
    { dia: "Sábado",    hora: "10:30", disponibles: 3,  total: 8 },
  ]),
  stretch: slots("st", [
    { dia: "Lunes",     hora: "09:00", disponibles: 10, total: 15 },
    { dia: "Martes",    hora: "20:00", disponibles: 8,  total: 15 },
    { dia: "Miércoles", hora: "09:00", disponibles: 0,  total: 15 },
    { dia: "Jueves",    hora: "20:00", disponibles: 13, total: 15 },
    { dia: "Viernes",   hora: "09:00", disponibles: 5,  total: 15 },
    { dia: "Sábado",    hora: "11:00", disponibles: 12, total: 15 },
  ]),
};
