// ── Configuración de la Jornada de Puertas Abiertas ──
// TODO está aquí: fecha y turnos. Para cambiar una hora, duración o tope,
// edita solo esta lista (2 minutos). Lo usan la página de reserva, la API y el admin.

export const EVENTO = {
  fecha: "24 de julio",
  titulo: "Jornada de Puertas Abiertas",
};

export type Slot = {
  id: string;                       // identificador único del turno
  bloque: "ninas" | "adultas";
  titulo: string;                   // "Pre-Ballet", "Barre Fit"…
  hora: string;                     // "10:00–11:00"
  tope: number;                     // plazas máximas del turno
};

export const SLOTS: Slot[] = [
  // 🌅 Mañana · Niñas (10:00–13:00)
  { id: "nin-pre-1",    bloque: "ninas",   titulo: "Pre-Ballet (3–6)",        hora: "10:00–11:00", tope: 12 },
  { id: "nin-pre-2",    bloque: "ninas",   titulo: "Pre-Ballet (3–6)",        hora: "11:00–12:00", tope: 12 },
  { id: "nin-ballet",   bloque: "ninas",   titulo: "Ballet 1 y 2 (7–14)",     hora: "12:00–13:00", tope: 12 },
  // 🌆 Tarde · Adultas (17:30–21:30) — Barre y Pilates alternos
  { id: "adu-barre-1",  bloque: "adultas", titulo: "Barre Fit",               hora: "17:30–18:30", tope: 12 },
  { id: "adu-pilates-1",bloque: "adultas", titulo: "Pilates Mat",             hora: "18:30–19:30", tope: 12 },
  { id: "adu-barre-2",  bloque: "adultas", titulo: "Barre Fit",               hora: "19:30–20:30", tope: 12 },
  { id: "adu-pilates-2",bloque: "adultas", titulo: "Pilates Mat",             hora: "20:30–21:30", tope: 12 },
];

export const slotById = (id: string): Slot | undefined => SLOTS.find(s => s.id === id);
