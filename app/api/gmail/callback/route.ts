/**
 * app/api/gmail/callback/route.ts
 *
 * Reçoit le retour de Google après consentement. Échange le `code` contre
 * les tokens, chiffre le refresh_token, l'enregistre dans gmail_accounts,
 * enregistre le watch Gmail (Pub/Sub), ET crée/retrouve le label
 * anti-boucle "FlowlyMail/Traite" une seule fois ici — plutôt que de le
 * revérifier à chaque mail dans n8n (optimisation).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { encrypt, verifyOAuthState } from "@/lib/crypto";
import { registerGmailWatch } from "@/lib/gmail-watch";
import { sendAlert } from "@/lib/alert";

export const runtime = "nodejs";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_PROFILE_ENDPOINT =
  "https://gmail.googleapis.com/gmail/v1/users/me/profile";
const GMAIL_LABELS_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/labels";
const NONCE_COOKIE = "gmail_oauth_nonce";
const LABEL_NAME = "FlowlyMail/Traite";

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface GmailProfileResponse {
  emailAddress: string;
}

interface GmailLabel {
  id: string;
  name: string;
}

/** Retrouve le label FlowlyMail/Traite s'il existe, sinon le crée. */
async function resolveFlowlyMailLabel(accessToken: string): Promise<string> {
  const listResponse = await fetch(GMAIL_LABELS_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (listResponse.ok) {
    const data = (await listResponse.json()) as { labels?: GmailLabel[] };
    const existing = data.labels?.find((l) => l.name === LABEL_NAME);
    if (existing) return existing.id;
  }

  const createResponse = await fetch(GMAIL_LABELS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: LABEL_NAME,
      labelListVisibility: "labelHide",
      messageListVisibility: "hide",
    }),
  });
  if (!createResponse.ok) {
    throw new Error(`Création du label échouée: ${await createResponse.text()}`);
  }
  const created = (await createResponse.json()) as GmailLabel;
  return created.id;
}

/** Redirige vers le dashboard avec un code d'erreur lisible côté UI. */
function redirectWithError(request: NextRequest, code: string) {
  const url = new URL("/dashboard", request.url);
  url.searchParams.set("gmail_error", code);
  const response = NextResponse.redirect(url);
  response.cookies.delete(NONCE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const requiredEnv = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "OAUTH_STATE_SECRET",
    "TOKEN_ENCRYPTION_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error("Variables d'environnement manquantes:", missing);
    return NextResponse.json(
      { error: "Configuration serveur incomplète" },
      { status: 500 }
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");

  if (googleError) {
    return redirectWithError(request, `google_${googleError}`);
  }
  if (!code || !state) {
    return redirectWithError(request, "missing_code_or_state");
  }

  let statePayload;
  try {
    statePayload = verifyOAuthState(state);
  } catch (err) {
    console.error("state OAuth invalide:", err);
    await sendAlert("gmail/callback: state OAuth invalide (lien altéré ou expiré)", err);
    return redirectWithError(request, "invalid_state");
  }

  const nonceCookie = request.cookies.get(NONCE_COOKIE)?.value;
  if (!nonceCookie || nonceCookie !== statePayload.nonce) {
    return redirectWithError(request, "nonce_mismatch");
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectWithError(request, "not_authenticated");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("entreprise_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.entreprise_id !== statePayload.entreprise_id) {
    return redirectWithError(request, "entreprise_mismatch");
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    console.error(
      "Échange de code Google échoué:",
      await tokenResponse.text()
    );
    return redirectWithError(request, "token_exchange_failed");
  }

  const tokens = (await tokenResponse.json()) as GoogleTokenResponse;

  if (!tokens.refresh_token) {
    return redirectWithError(request, "no_refresh_token");
  }

  const profileResponse = await fetch(GMAIL_PROFILE_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!profileResponse.ok) {
    console.error(
      "Récupération du profil Gmail échouée:",
      await profileResponse.text()
    );
    return redirectWithError(request, "profile_fetch_failed");
  }

  const gmailProfile = (await profileResponse.json()) as GmailProfileResponse;

  const service = createServiceSupabase();

  const { data: existingAccount, error: lookupError } = await service
    .from("gmail_accounts")
    .select("id, entreprise_id")
    .eq("email_surveille", gmailProfile.emailAddress)
    .maybeSingle();

  if (lookupError) {
    console.error("Vérification gmail_accounts échouée:", lookupError);
    return redirectWithError(request, "db_lookup_failed");
  }

  if (existingAccount && existingAccount.entreprise_id !== statePayload.entreprise_id) {
    await service.from("activity_logs").insert({
      entreprise_id: statePayload.entreprise_id,
      profile_id: user.id,
      actor_type: "user",
      action: "gmail_connect_rejected_already_linked",
      metadata: { email: gmailProfile.emailAddress },
    });
    return redirectWithError(request, "gmail_already_linked_to_another_entreprise");
  }

  // Résout (ou crée) le label anti-boucle une seule fois ici, plutôt que
  // de le revérifier à chaque mail dans n8n.
  let labelId: string | null = null;
  try {
    labelId = await resolveFlowlyMailLabel(tokens.access_token);
  } catch (labelError) {
    console.error("Résolution du label FlowlyMail échouée:", labelError);
    await sendAlert("gmail/callback: résolution du label FlowlyMail/Traite échouée", labelError);
    // Non-bloquant : le compte reste utilisable, n8n retentera plus tard
    // si besoin (voir note dans Check_Gmail_Account).
  }

  const expiresAt = new Date(
    Date.now() + tokens.expires_in * 1000
  ).toISOString();

  const { error: upsertError } = await service.from("gmail_accounts").upsert(
    {
      entreprise_id: statePayload.entreprise_id,
      email_surveille: gmailProfile.emailAddress,
      provider: "gmail",
      refresh_token_encrypted: encrypt(tokens.refresh_token),
      access_token_encrypted: encrypt(tokens.access_token),
      access_token_expires_at: expiresAt,
      scope: tokens.scope,
      status: "active",
      connected_at: new Date().toISOString(),
      flowlymail_label_id: labelId,
    },
    { onConflict: "email_surveille" }
  );

  if (upsertError) {
    console.error("Écriture gmail_accounts échouée:", upsertError);
    return redirectWithError(request, "db_write_failed");
  }

  try {
    const watch = await registerGmailWatch(tokens.access_token);
    await service
      .from("gmail_accounts")
      .update({
        history_id: watch.historyId,
        watch_expiration: new Date(watch.expirationMs).toISOString(),
      })
      .eq("email_surveille", gmailProfile.emailAddress);
  } catch (watchError) {
    console.error("Enregistrement du watch Gmail échoué:", watchError);
    await sendAlert("gmail/callback: enregistrement du watch Gmail échoué", watchError);
    await service.from("activity_logs").insert({
      entreprise_id: statePayload.entreprise_id,
      actor_type: "system",
      action: "gmail_watch_registration_failed",
      metadata: { email: gmailProfile.emailAddress },
    });
  }

  await service.from("activity_logs").insert({
    entreprise_id: statePayload.entreprise_id,
    profile_id: user.id,
    actor_type: "user",
    action: "gmail_connected",
    metadata: { email: gmailProfile.emailAddress },
  });

  const response = NextResponse.redirect(
    new URL("/dashboard?gmail=connected", request.url)
  );
  response.cookies.delete(NONCE_COOKIE);
  return response;
}
