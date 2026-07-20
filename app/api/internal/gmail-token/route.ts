/**
 * app/api/internal/gmail-token/route.ts
 *
 * Token Broker (architecture v3, §3). Seul point d'accès aux tokens Gmail
 * pour n8n. Ne renvoie jamais le refresh_token : uniquement un access_token
 * de courte durée (≤1h) pour le compte demandé. n8n ne stocke ni ne
 * déchiffre jamais rien lui-même.
 *
 * Protégé par un secret partagé (header x-n8n-secret). N'appeler que
 * depuis n8n, jamais depuis un client public.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { encrypt, decrypt } from "@/lib/crypto";

export const runtime = "nodejs";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
// Rafraîchit si moins de 5 minutes de validité restent sur l'access_token.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface RequestBody {
  gmail_account_id?: string;
}

interface GoogleRefreshResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const requiredEnv = [
    "N8N_INTERNAL_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "TOKEN_ENCRYPTION_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error("Variables d'environnement manquantes:", missing);
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  // 1. Authentification serveur-à-serveur (n8n uniquement)
  const providedSecret = request.headers.get("x-n8n-secret");
  if (!providedSecret || providedSecret !== process.env.N8N_INTERNAL_SECRET) {
    return unauthorized();
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  const gmailAccountId = body.gmail_account_id;
  if (!gmailAccountId) {
    return NextResponse.json(
      { error: "gmail_account_id_required" },
      { status: 400 }
    );
  }

  const service = createServiceSupabase();

  const { data: account, error: fetchError } = await service
    .from("gmail_accounts")
    .select(
      "id, entreprise_id, email_surveille, refresh_token_encrypted, access_token_encrypted, access_token_expires_at, status"
    )
    .eq("id", gmailAccountId)
    .maybeSingle();

  if (fetchError) {
    console.error("Lecture gmail_accounts échouée:", fetchError);
    return NextResponse.json({ error: "db_read_failed" }, { status: 500 });
  }

  if (!account) {
    return NextResponse.json({ error: "gmail_account_not_found" }, { status: 404 });
  }

  if (account.status === "revoked") {
    return NextResponse.json(
      { error: "gmail_account_revoked", email_surveille: account.email_surveille },
      { status: 409 }
    );
  }

  // 2. Chemin rapide : l'access_token en cache est encore valide.
  const cachedExpiresAt = account.access_token_expires_at
    ? new Date(account.access_token_expires_at).getTime()
    : 0;

  if (
    account.access_token_encrypted &&
    cachedExpiresAt - Date.now() > REFRESH_MARGIN_MS
  ) {
    const accessToken = decrypt(account.access_token_encrypted);
    return NextResponse.json({
      access_token: accessToken,
      email_surveille: account.email_surveille,
    });
  }

  // 3. Sinon, rafraîchit auprès de Google avec le refresh_token déchiffré.
  //    Le refresh_token ne quitte jamais cette fonction.
  const refreshToken = decrypt(account.refresh_token_encrypted);

  const refreshResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const refreshResult = (await refreshResponse.json()) as GoogleRefreshResponse;

  if (!refreshResponse.ok) {
    if (refreshResult.error === "invalid_grant") {
      // Le client a révoqué l'accès depuis son compte Google, ou le
      // refresh_token a expiré (longue inactivité). Le dashboard devra
      // inviter l'entreprise à reconnecter Gmail.
      await service
        .from("gmail_accounts")
        .update({ status: "revoked" })
        .eq("id", gmailAccountId);

      await service.from("activity_logs").insert({
        entreprise_id: account.entreprise_id,
        actor_type: "n8n",
        action: "gmail_token_refresh_revoked",
        metadata: { email: account.email_surveille },
      });

      return NextResponse.json(
        { error: "gmail_account_revoked", email_surveille: account.email_surveille },
        { status: 409 }
      );
    }

    console.error("Rafraîchissement du token Google échoué:", refreshResult);
    return NextResponse.json({ error: "token_refresh_failed" }, { status: 502 });
  }

  const newExpiresAt = new Date(
    Date.now() + refreshResult.expires_in * 1000
  ).toISOString();

  const { error: updateError } = await service
    .from("gmail_accounts")
    .update({
      access_token_encrypted: encrypt(refreshResult.access_token),
      access_token_expires_at: newExpiresAt,
    })
    .eq("id", gmailAccountId);

  if (updateError) {
    // On renvoie quand même le token frais : n8n peut travailler
    // immédiatement, et le prochain appel retentera l'écriture du cache.
    console.error("Mise à jour du cache gmail_accounts échouée:", updateError);
  } else {
    await service.from("activity_logs").insert({
      entreprise_id: account.entreprise_id,
      actor_type: "n8n",
      action: "gmail_token_refreshed",
      metadata: { email: account.email_surveille },
    });
  }

  return NextResponse.json({
    access_token: refreshResult.access_token,
    email_surveille: account.email_surveille,
  });
}
