// Coupon definitions — shared between client (display) and server (charge).
// The server re-validates the code so a discount can't be applied without it.

export interface Coupon {
  code: string;
  descuento: number; // fracción, ej. 0.99 = 99% de descuento
  label: string;
}

const COUPONS: Coupon[] = [
  { code: "GIOANDRE€€", descuento: 0.99, label: "Descuento de prueba" },
];

// Stripe rejects charges below €0.50.
const STRIPE_MIN_EUR = 0.5;

export function findCoupon(code: string): Coupon | null {
  const normalized = code.trim();
  if (!normalized) return null;
  return COUPONS.find((c) => c.code === normalized) ?? null;
}

// Applies a coupon to an amount, rounded to cents and clamped to Stripe's minimum.
export function applyCoupon(amount: number, coupon: Coupon | null): number {
  if (!coupon) return amount;
  const discounted = amount * (1 - coupon.descuento);
  const rounded = Math.round(discounted * 100) / 100;
  return Math.max(STRIPE_MIN_EUR, rounded);
}
