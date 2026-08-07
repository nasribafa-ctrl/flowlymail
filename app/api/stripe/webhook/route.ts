/**
 * app/api/stripe/webhook/route.ts
 *
 * Reçoit les événements Stripe. La signature doit être vérifiée sur le
 * corps brut de la requête (pas sur du JSON reparsé) : le App Router ne
 * parse jamais automatiquement le body, donc request.text() renvoie déjà
 * les octets exacts envoyés par Stripe.
 */

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createStripeClient } from "@/lib/stripe";
import { createServiceSupabase } from "@/lib/supabase/service";
import { sendAlert } from "@/lib/alert";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("Variables d'environnement manquantes: STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = createStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Signature du webhook Stripe invalide:", err);
    await sendAlert("stripe/webhook: signature invalide (secret mal configuré ou requête suspecte)", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const entrepriseId = session.metadata?.entreprise_id;

    if (!entrepriseId) {
      console.error("checkout.session.completed reçu sans entreprise_id en metadata:", session.id);
      return NextResponse.json({ received: true });
    }

    const service = createServiceSupabase();
    const { error } = await service
      .from("entreprise")
      .update({ stripe_subscription_status: "active" })
      .eq("id", entrepriseId);

    if (error) {
      console.error("Mise à jour de stripe_subscription_status échouée:", error);
      // 500 pour que Stripe rejoue l'événement plus tard.
      return NextResponse.json({ error: "db_update_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
