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

// Datos fiscales del emisor para el pie de las facturas de Stripe (los ajustes de
// la cuenta solo se editan en el panel de Stripe; esto los pone por cliente y sí
// se puede por API). El IVA se cuadra aparte con la asesora.
export const FOOTER_FISCAL =
  "Andrea Carrió Caselles — NIF 53947178B\nC/ Motilla del Palancar 34 bajo, 46019 Valencia (España)";

// IVA de las facturas (tipos creados en Stripe, precio con IVA incluido):
//  - Barre / Pilates (adultas) → 21%.
//  - Ballet niñas → exento.
export const TAX_IVA_21 = "txr_1TxWOnC2EhICsmIsYXEKLmfH";
export const TAX_IVA_EXENTO = "txr_1TxWOnC2EhICsmIslQfQcYmH";
const DISCIPLINAS_NINAS = ["pre-ballet", "ballet-i", "ballet-ii"];
export const ivaDe = (disciplinaId: string): string =>
  DISCIPLINAS_NINAS.includes(disciplinaId) ? TAX_IVA_EXENTO : TAX_IVA_21;
