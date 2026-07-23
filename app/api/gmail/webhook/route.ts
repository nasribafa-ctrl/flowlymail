/**
 * app/api/gmail/webhook/route.ts
 *
 * Reçoit les notifications push de Google Pub/Sub quand un nouveau mail
 * arrive dans une boîte Gmail connectée. Remplace le polling "toutes les
 * minutes" de l'Orchestrateur n8n — on ne déclenche le traitement que
 * quand il y a réellement quelque chose de nouveau.
 *
 * Configuration attendue côté Google Cloud : une souscription Pub/Sub de
 * type "Push" pointant vers cette URL, avec le paramètre `?token=...`
 * (voir GMAIL_WEBHOOK_SECRET) pour vérifier que l'appel vient bien de
 * notre souscription et pas d'un tiers.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";

interface PubSubPushBody {
  message?: {
    data?: string; // base64
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
}

interface GmailNotificationData {
  emailAddress: string;
  historyId: string | number;
}

export async function POST(request: NextRequest) {
  // Vérifie que l'appel vient bien de notre souscription Pub/Sub (secret
  // partagé dans l'URL de la souscription, configuré côté Google Cloud).
  const token = request.nextUrl.searchParams.get("token");
  if (!process.env.GMAIL_WEBHOOK_SECRET || token !== process.env.GMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as PubSubPushBody | null;
  const dataB64 = body?.message?.data;

  // On répond 200 même sans données exploitables : Pub/Sub réessaie
  // indéfiniment sur toute réponse non-2xx, mieux vaut acquitter et logger.
  if (!dataB64) {
    console.error("Webhook Gmail: message Pub/Sub sans données");
    return NextResponse.json({ ok: true });
  }

  let notification: GmailNotificationData;
  try {
    const decoded = Buffer.from(dataB64, "base64").toString("utf8");
    notification = JSON.parse(decoded);
  } catch (err) {
    console.error("Webhook Gmail: décodage du message échoué:", err);
    return NextResponse.json({ ok: true });
  }

  if (!notification.emailAddress) {
    return NextResponse.json({ ok: true });
  }

  const service = createServiceSupabase();

  const { data: account, error: lookupError } = await service
    .from("gmail_accounts")
    .select("id, status")
    .eq("email_surveille", notification.emailAddress)
    .maybeSingle();

  if (lookupError) {
    console.error("Webhook Gmail: recherche du compte échouée:", lookupError);
    return NextResponse.json({ ok: true });
  }

  if (!account || account.status !== "active") {
    // Compte inconnu ou révoqué : on ignore silencieusement, ce n'est pas
    // une erreur (peut arriver après une déconnexion Gmail par exemple).
    return NextResponse.json({ ok: true });
  }

  // Déclenche n8n en fire-and-forget : on ne bloque pas la réponse à
  // Pub/Sub en attendant que tout le traitement du mail se termine.
  const n8nWebhookUrl = process.env.N8N_GMAIL_PUSH_WEBHOOK_URL;
  if (!n8nWebhookUrl) {
    console.error("Webhook Gmail: N8N_GMAIL_PUSH_WEBHOOK_URL manquant");
    return NextResponse.json({ ok: true });
  }

  try {
    await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gmail_account_id: account.id }),
    });
  } catch (err) {
    // On logge mais on répond quand même 200 : une notification manquée
    // sera de toute façon rattrapée à la prochaine, Gmail les regroupe
    // par historyId côté Check Gmail Account si besoin d'aller plus loin.
    console.error("Webhook Gmail: appel n8n échoué:", err);
  }

  return NextResponse.json({ ok: true });
}
