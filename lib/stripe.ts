/**
 * lib/stripe.ts
 *
 * Client Stripe serveur, initialisé avec la clé secrète. À utiliser
 * uniquement côté serveur (Route Handlers) — ne jamais importer depuis un
 * composant client.
 */

import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY est requis pour initialiser le client Stripe");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-07-29.dahlia",
});
