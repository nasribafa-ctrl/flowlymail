/**
 * app/api/gmail/webhook/route.ts
 *
 * Reçoit les notifications push de Google Pub/Sub quand un nouveau mail
 * arrive dans une boîte Gmail connectée. Remplace le polling "toutes les
 * minutes" de l'Orchestrateur n8n — on ne déclenche le traitement que
 * quand il y a réellement quelque chose de nouveau.
 *
 * IMPORTANT : Google envoie souvent PLUSIEURS notifications pour un seul
 * mail reçu (comportement normal de Gmail — chaque petit changement
 * interne compte comme un événement séparé). Sans protection, ça
 * déclenche plusieurs exécutions n8n simultanées pour le même mail, qui
 * se marchent dessus et échouent. On ajoute donc un anti-rebond : si ce
 * compte a déjà été déclenché il y a moins de 20 secondes, on ignore.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";

const DEBOUNCE_WINDOW_MS = 20 * 1000;

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
  const token = request.nextUrl.searchParams.get("token");
  if (!process.env.GMAIL_WEBHOOK_SECRET || token !== process.env.GMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as PubSubPushBody | null;
  const dataB64 = body?.message?.data;

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
    .select("id, status, last_checked_at")
    .eq("email_surveille", notification.emailAddress)
    .maybeSingle();

  if (lookupError) {
    console.error("Webhook Gmail: recherche du compte échouée:", lookupError);
    return NextResponse.json({ ok: true });
  }

  if (!account || account.status !== "active") {
    return NextResponse.json({ ok: true });
  }

  // Anti-rebond : Google envoie souvent plusieurs notifications pour un
  // seul mail. Si ce compte a déjà été déclenché très récemment, on
  // ignore cette notification-ci plutôt que de lancer un traitement en
  // double qui entrerait en collision avec le premier.
  if (account.last_checked_at) {
    const elapsed = Date.now() - new Date(account.last_checked_at).getTime();
    if (elapsed < DEBOUNCE_WINDOW_MS) {
      return NextResponse.json({ ok: true, skipped: "debounced" });
    }
  }

  // On "réserve" immédiatement ce compte en mettant à jour last_checked_at
  // AVANT d'appeler n8n, pour que les notifications suivantes (même
  // arrivant dans la même seconde) voient bien ce timestamp à jour.
  await service
    .from("gmail_accounts")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("id", account.id);

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
    console.error("Webhook Gmail: appel n8n échoué:", err);
  }

  return NextResponse.json({ ok: true });
}
