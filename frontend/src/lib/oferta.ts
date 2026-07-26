// Deadline de la oferta de matrícula (35€ → 50€). Única fuente de verdad para el
// precio y para el reloj de cuenta atrás, así ambos cambian en el MISMO instante.
// Fecha local (Valencia = Madrid): la matrícula sube el 1 de agosto a las 00:00.
export const MATRICULA_OFERTA_HASTA = new Date("2026-07-31T23:59:59");

export const matriculaEnOferta = (ahora: Date = new Date()) => ahora <= MATRICULA_OFERTA_HASTA;
export const precioMatricula = (ahora: Date = new Date()) => (matriculaEnOferta(ahora) ? 35 : 50);
