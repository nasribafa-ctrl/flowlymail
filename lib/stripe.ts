/**
 * lib/stripe.ts
 *
 * Client Stripe serveur. À utiliser uniquement côté serveur (Route
 * Handlers) — ne jamais importer depuis un composant client.
 *
 * Construit à l'appel (comme createServiceSupabase) plutôt qu'au chargement
 * du module : le constructeur Stripe lève une exception synchrone si la clé
 * est absente, ce qui ferait planter l'import du module — et donc toute
 * route qui l'importe — avant même que son propre contrôle de variables
 * d'environnement ait pu répondre proprement en JSON.
 */

import Stripe from "stripe";

export function createStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY est requis pour initialiser le client Stripe");
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-07-29.dahlia",
  });
}
