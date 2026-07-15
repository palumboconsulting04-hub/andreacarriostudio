// ── Configuración de la Jornada de Puertas Abiertas ──
// TODO está aquí: fecha y turnos. Para cambiar una hora, duración o tope,
// edita solo esta lista (2 minutos). Lo usan la página de reserva, la API y el admin.

export const EVENTO = {
  fecha: "Viernes 24 y sábado 25 de julio",
  titulo: "Jornada de Puertas Abiertas",
};

export type Slot = {
  id: string;                       // identificador único del turno
  bloque: "ninas" | "adultas";
  titulo: string;                   // "Pre-Ballet", "Barre Fit"…
  hora: string;                     // "10:00–11:00"
  tope: number;                     // plazas máximas del turno
  dia: string;                      // "Viernes 24 de julio", "Sábado 25 de julio"
};

export const SLOTS: Slot[] = [
  // 🌅 Viernes 24 · Mañana · Ballet infantil (9:30–13:40)
  { id: "nin-pre",         bloque: "ninas",   titulo: "Pre-Ballet (3–6)",    hora: "9:30–10:45",  tope: 20, dia: "Viernes 24 de julio" },
  { id: "nin-ballet-1",    bloque: "ninas",   titulo: "Ballet 1 (7–9)",      hora: "11:00–12:20", tope: 12, dia: "Viernes 24 de julio" },
  { id: "nin-ballet-2",    bloque: "ninas",   titulo: "Ballet 2 (10–14)",    hora: "12:30–13:40", tope: 12, dia: "Viernes 24 de julio" },
  // 🌆 Viernes 24 · Tarde · Barre y Pilates (17:00–21:00)
  { id: "adu-barre-1",     bloque: "adultas", titulo: "Barre Fit · Grupo 1", hora: "17:00–18:20", tope: 12, dia: "Viernes 24 de julio" },
  { id: "adu-pilates",     bloque: "adultas", titulo: "Pilates Mat",         hora: "18:20–19:40", tope: 12, dia: "Viernes 24 de julio" },
  { id: "adu-barre-2",     bloque: "adultas", titulo: "Barre Fit · Grupo 2", hora: "19:40–21:00", tope: 12, dia: "Viernes 24 de julio" },
  // 🌅 Sábado 25 · Mañana · Barre (adultas)
  { id: "adu-sab-barre-1", bloque: "adultas", titulo: "Barre Fit · Grupo 1", hora: "10:00–11:20", tope: 12, dia: "Sábado 25 de julio" },
  { id: "adu-sab-barre-2", bloque: "adultas", titulo: "Barre Fit · Grupo 2", hora: "11:20–12:40", tope: 12, dia: "Sábado 25 de julio" },
];

export const slotById = (id: string): Slot | undefined => SLOTS.find(s => s.id === id);
