export type DisciplinaId =
  | "pilates-suelo"
  | "pilates-reformer"
  | "barre"
  | "ballet-i"
  | "ballet-ii"
  | "stretch";

export type PlanId = "basico" | "avanzado" | "intensivo";

export type MetodoPago = "tarjeta" | "google-pay" | "apple-pay" | "paypal";

export interface Disciplina {
  id: DisciplinaId;
  nombre: string;
  descripcion: string;
  emoji: string;
  gradientFrom: string;
  gradientTo: string;
  soloIntensivo?: boolean;
}

export interface Plan {
  id: PlanId;
  nombre: string;
  precio: number;
  sesionesPorSemana: number;
  sesionesMes: number;
  features: string[];
  destacado?: boolean;
}

export interface HorarioSlot {
  id: string;
  dia: string;
  hora: string;
  disponibles: number;
  total: number;
}

export interface InscripcionState {
  disciplina: DisciplinaId | null;
  plan: PlanId | null;
  horarios: string[];
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  metodoPago: MetodoPago;
}
