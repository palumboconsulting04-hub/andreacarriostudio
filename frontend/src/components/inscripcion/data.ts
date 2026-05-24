import type { Disciplina, Plan, HorarioSlot, DisciplinaId, PlanId } from "./types";

export const disciplinas: Disciplina[] = [
  {
    id: "pilates-mat",
    nombre: "Pilates Mat",
    descripcion: "Conecta tu centro, mejora tu postura y fortalece tu cuerpo a través de la respiración.",
    imagen: "https://lh3.googleusercontent.com/aida/ADBb0ugojefKfdgnG23qLdP5o5CTxaWkVEUqVO21OhjCuYJCHIH5loDmvuuyiwBxRuL4Jv0hHsO8hy3hevSQalHJXvQg_dval1uqZfHvdTiEGZUS4OD4BradwaMzC8mbv4TPVsreSOAf9lGslGrXxJrA5Wr3_TFhiM1vNM92nZGMV_tah1nAGlE9AI9YzMnf9fX5m8wtxz2Qfvu4bTbNTziZ_qR6Xhi9gLxbC9Yfdf5S2iS4ifKuYkz4JVp11Qs6",
  },
  {
    id: "barre-fit",
    nombre: "Barre Fit",
    descripcion: "Fusión de técnica clásica, yoga y pilates para esculpir y tonificar con gracia.",
    imagen: "https://lh3.googleusercontent.com/aida-public/AB6AXuDz5OIBKM_u2ZlVPO98dZS592lm2WJUKjj0Dggs7uAeglwN_J88YCHwCVZvXb2KfpmG8ecAgMRz4kkHMNh0w-M8x6aueE7n15_6e-oHYVDf2dE8B0XrseMcztDMuJzx2EHWMpWyO9GdzVPxuu2QbovlNZKeXBSrNB2n5IvIgLCqMRsjWSkmAD9rSEHn1bC3l1_Gfcq55iEr-o-RfnGDW2zHVThkC4k0It6RROZh7tYDbZ1kdCiBqlD5yFS2VEAJ65dwjr9I5BWL7RRh",
  },
  {
    id: "pre-ballet",
    nombre: "Pre Ballet 2-6 años",
    descripcion: "Iniciación al movimiento, la musicalidad y la expresión corporal de forma lúdica.",
    imagen: "https://lh3.googleusercontent.com/aida-public/AB6AXuAN7JX9zaZ-laqB6biwAAXtAm0DRmgqB270XK0tbKMyYeuZM33512Zva_20xqze2asqxmRLLOtkKlUx4GEVRpfS1JE9dSrGIERnseSGIQLqotjmpa9iQe5dMyqYqAnQdmH3lRpti5lpenkeotMivv4UD6WGpADe0g-jiIedHQ-wn1fzk2JAy0hhLMnuv7qwneyLtvygTlxWJ0BeuideHt6DsoV5nDCCWRI4AhTwe5NEnjcg0Gfkv_o9H0L0vvmkbCwqehEtfZiZevXL",
  },
  {
    id: "ballet-i",
    nombre: "Ballet I 7-9 años",
    descripcion: "Desarrollo de la técnica base, postura y disciplina en un entorno inspirador.",
    imagen: "https://lh3.googleusercontent.com/aida-public/AB6AXuBy1SHCTHXADtlvt-Mv9fe6uQ9VkXQHm_oavaWzwRaDgM6DurA2BNOpa6JahtCw6I-Q5x3isTNwdpjBNPqoQcKUBrT8yDjW7YU1_tOaC00TWrzNOFXdhsV7v3HJ9294LI0hAIVjybtHVhp65CVQ7wl0SMQNnXccXn0EaHD8ELWrjBAcp2iFPYMlrXX2B_wnBkRWNsd5HbT1mPxVMjlgHL5QcuKgE-dIc3rOm3wQHJkRKpto1KG9lDuUmJkXfvv8zXvjQCnAk4sQusDb",
  },
  {
    id: "ballet-ii",
    nombre: "Ballet II 10-12 años",
    descripcion: "Perfeccionamiento técnico, fuerza y fluidez para jóvenes talentos.",
    imagen: "https://lh3.googleusercontent.com/aida-public/AB6AXuCRUp_DadNt3Zuxz76Tdb54gqhb-ottH70KACUrX2vZWKzw7XjcwYqLGA43ypg3Ffc-NxCYfRwxL4-lwAFLVsr3vtLBF9XkCTT3bJkhkDrfPaStIKrSUQFF_O378M3dTxUN3TvJLu0UHAWauacYR3O708MREX5ziEg4VyLV3DRMmMZa91JLXxnVVimri3z5K2T11TwzP9PMlhKyrJ0-NgyMDhXGGcEqKcZ7npo0lCFqajI7i3fq5DodkwSWQm15Dk_rtggqex762mzn",
    soloIntensivo: true,
  },
  {
    id: "ballet-adultos",
    nombre: "Ballet Adultos",
    descripcion: "Nunca es tarde para la gracia. Mejora tu elongación, postura y bienestar general.",
    imagen: "https://lh3.googleusercontent.com/aida-public/AB6AXuDYLlrFap58Zb1z0uMA7VY2FX7MNMokhapaUI4qeO1xr7fvND9Q_8bp7jKbaLb8eViwSMzAzE7a6u8LjFLXd4i6i_xLEwfdatyMenTrTEcLzEOjj-tzT4CSvNMCMU14KNvZvxFqMzw2yMSMp1BV9o38sorPpBJQJkuDkqeK1gChtHCjwEThWpUlsY0YjXWYvtY43rkLXFx9bR75ojqal56xouyFSb1hfNouXNxDGXA6H3sm-IHpp-At67wh2g-LjSePzgtcqslhIym0",
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
  "pilates-mat": slots("pm", [
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
  "barre-fit": slots("bf", [
    { dia: "Lunes",     hora: "10:00", disponibles: 6,  total: 12 },
    { dia: "Lunes",     hora: "19:30", disponibles: 0,  total: 12 },
    { dia: "Martes",    hora: "09:00", disponibles: 9,  total: 12 },
    { dia: "Miércoles", hora: "10:00", disponibles: 3,  total: 12 },
    { dia: "Jueves",    hora: "18:30", disponibles: 11, total: 12 },
    { dia: "Viernes",   hora: "09:00", disponibles: 5,  total: 12 },
    { dia: "Viernes",   hora: "19:00", disponibles: 0,  total: 12 },
    { dia: "Sábado",    hora: "10:00", disponibles: 8,  total: 12 },
  ]),
  "pre-ballet": slots("pb", [
    { dia: "Lunes",     hora: "17:00", disponibles: 8,  total: 10 },
    { dia: "Miércoles", hora: "17:00", disponibles: 5,  total: 10 },
    { dia: "Viernes",   hora: "17:00", disponibles: 3,  total: 10 },
    { dia: "Sábado",    hora: "10:00", disponibles: 10, total: 10 },
  ]),
  "ballet-i": slots("b1", [
    { dia: "Lunes",     hora: "18:00", disponibles: 5,  total: 10 },
    { dia: "Martes",    hora: "17:30", disponibles: 0,  total: 10 },
    { dia: "Miércoles", hora: "18:00", disponibles: 3,  total: 10 },
    { dia: "Jueves",    hora: "17:30", disponibles: 7,  total: 10 },
    { dia: "Viernes",   hora: "18:00", disponibles: 2,  total: 10 },
    { dia: "Sábado",    hora: "09:00", disponibles: 8,  total: 10 },
  ]),
  "ballet-ii": slots("b2", [
    { dia: "Lunes",     hora: "19:00", disponibles: 4,  total: 8 },
    { dia: "Miércoles", hora: "19:00", disponibles: 0,  total: 8 },
    { dia: "Jueves",    hora: "19:30", disponibles: 2,  total: 8 },
    { dia: "Viernes",   hora: "19:00", disponibles: 6,  total: 8 },
    { dia: "Sábado",    hora: "10:30", disponibles: 3,  total: 8 },
  ]),
  "ballet-adultos": slots("ba", [
    { dia: "Lunes",     hora: "20:00", disponibles: 7,  total: 12 },
    { dia: "Miércoles", hora: "20:00", disponibles: 4,  total: 12 },
    { dia: "Jueves",    hora: "19:30", disponibles: 9,  total: 12 },
    { dia: "Sábado",    hora: "11:00", disponibles: 12, total: 12 },
  ]),
};
