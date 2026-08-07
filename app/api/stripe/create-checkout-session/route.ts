/**
 * app/api/stripe/create-checkout-session/route.ts
 *
 * Crée une session Stripe Checkout (abonnement) pour l'entreprise de
 * l'utilisateur connecté et renvoie son URL, vers laquelle le frontend
 * redirige. Le price utilisé vient uniquement de STRIPE_PRICE_ID (jamais
 * du client) pour empêcher qu'un appel manipulé fasse payer un autre
 * montant.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    console.error("Variables d'environnement manquantes: STRIPE_SECRET_KEY / STRIPE_PRICE_ID");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("entreprise_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.entreprise_id) {
    return NextResponse.json({ error: "no_entreprise" }, { status: 400 });
  }

  const stripe = createStripeClient();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      metadata: { entreprise_id: profile.entreprise_id },
      success_url: new URL("/dashboard?payment=success", request.url).toString(),
      cancel_url: new URL("/dashboard?payment=cancelled", request.url).toString(),
    });

    if (!session.url) {
      console.error("Session Stripe créée sans URL:", session.id);
      return NextResponse.json({ error: "checkout_session_failed" }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Création de la session Stripe Checkout échouée:", err);
    return NextResponse.json({ error: "checkout_session_failed" }, { status: 502 });
  }
}
