// Coupon definitions — shared between client (display) and server (charge).
// The server re-validates the code so a discount can't be applied without it.

export interface Coupon {
  code: string;
  /** Descuento en fracción, ej. 0.99 = 99%. Alternativa a descuentoFijo. */
  descuento?: number;
  /** Descuento fijo en euros, ej. 35 = 35€ menos. */
  descuentoFijo?: number;
  /** Importe mínimo para poder usarlo (evita regalar una matrícula suelta). */
  minImporte?: number;
  label: string;
  /** Mensaje cuando no se llega al mínimo. */
  avisoMinimo?: string;
}

const COUPONS: Coupon[] = [
  { code: "GIOANDRE€€", descuento: 0.99, label: "Descuento de prueba" },
  // Madre + hija en la MISMA reserva (mismo email): se regala una matrícula.
  // El mínimo de 70€ = dos matrículas, así que solo funciona cuando se apuntan
  // las dos juntas y nunca puede regalar una matrícula suelta.
  {
    code: "JUNTAS",
    descuentoFijo: 35,
    minImporte: 70,
    label: "Matrícula de la 2ª gratis",
    avisoMinimo: "Este código es para apuntaros dos con el mismo email (por ejemplo, tu hija y tú). Añade la segunda inscripción y se aplica solo.",
  },
];

// Stripe rejects charges below €0.50.
const STRIPE_MIN_EUR = 0.5;

export function findCoupon(code: string): Coupon | null {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  return COUPONS.find((c) => c.code.toUpperCase() === normalized) ?? null;
}

/** ¿Se puede usar este cupón para este importe? */
export function couponAplicable(amount: number, coupon: Coupon | null): boolean {
  if (!coupon) return false;
  return amount >= (coupon.minImporte ?? 0);
}

// Applies a coupon to an amount, rounded to cents and clamped to Stripe's minimum.
export function applyCoupon(amount: number, coupon: Coupon | null): number {
  if (!coupon || !couponAplicable(amount, coupon)) return amount;
  const discounted = coupon.descuentoFijo != null
    ? amount - coupon.descuentoFijo
    : amount * (1 - (coupon.descuento ?? 0));
  const rounded = Math.round(discounted * 100) / 100;
  return Math.max(STRIPE_MIN_EUR, rounded);
}

/** Texto del descuento para mostrar en el resumen ("−35€" o "−99%"). */
export function couponEtiqueta(coupon: Coupon): string {
  return coupon.descuentoFijo != null
    ? `−${coupon.descuentoFijo}€`
    : `−${Math.round((coupon.descuento ?? 0) * 100)}%`;
}
