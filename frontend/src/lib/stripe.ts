import Stripe from "stripe";

// Cliente Stripe de servidor (usa la secret key). No importar en cliente.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Fecha en la que arranca el cobro del bono mensual (1 de septiembre 2026, hora de Madrid).
// A partir de aquí Stripe cobra automáticamente cada mes.
export const BONO_BILLING_ANCHOR = Math.floor(
  Date.parse("2026-09-01T00:00:00+02:00") / 1000
);

// Marca en metadata para distinguir el pago de matrícula (que dispara la creación
// de la suscripción) de cualquier otro PaymentIntent.
export const MATRICULA_PI_TIPO = "matricula-bono";
