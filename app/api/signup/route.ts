/**
 * app/api/signup/route.ts
 *
 * Crée un compte utilisateur, mais uniquement si un code d'invitation
 * valide et non utilisé est fourni (table `invite_codes`). L'inscription
 * libre (supabase.auth.signUp côté client) est volontairement remplacée
 * par cette route serveur : la vérification et la consommation du code
 * doivent se faire avec la clé service_role, hors de portée du client.
 *
 * Limitée à 10 tentatives par IP et par heure (comptage via
 * activity_logs, même logique que generate-infos/route.ts) : sans ça,
 * n'importe qui pourrait bruteforcer un code d'invitation par essais
 * répétés — impossible de limiter par compte puisqu'aucun compte
 * n'existe encore à ce stade.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";

const RATE_LIMIT_MAX_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  const service = createServiceSupabase();
  const ip = getClientIp(request);
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const { count, error: countError } = await service
    .from("activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("action", "signup_attempt")
    .contains("metadata", { ip })
    .gte("created_at", windowStart);

  if (countError) {
    console.error("Vérification du quota signup échouée:", countError);
    return NextResponse.json({ error: "rate_limit_check_failed" }, { status: 500 });
  }

  if ((count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: "Trop de tentatives. Réessayez dans une heure.",
      },
      { status: 429 }
    );
  }

  await service.from("activity_logs").insert({
    actor_type: "anonymous",
    action: "signup_attempt",
    metadata: { ip },
  });

  const body = await request.json().catch(() => null);
  const email = body?.email?.trim();
  const password = body?.password;
  const inviteCode = body?.invite_code?.trim();

  if (!email) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "password_required" }, { status: 400 });
  }
  if (!inviteCode) {
    return NextResponse.json({ error: "invite_code_required" }, { status: 400 });
  }

  const { data: invite, error: inviteError } = await service
    .from("invite_codes")
    .select("used_by")
    .eq("code", inviteCode)
    .maybeSingle();

  if (inviteError) {
    console.error("Lecture invite_codes échouée:", inviteError);
    return NextResponse.json({ error: "invite_code_check_failed" }, { status: 500 });
  }
  if (!invite) {
    return NextResponse.json({ error: "invalid_invite_code" }, { status: 400 });
  }
  if (invite.used_by) {
    return NextResponse.json({ error: "invite_code_already_used" }, { status: 400 });
  }

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    console.error("Création utilisateur échouée:", createError);
    const status = createError?.status === 422 ? 400 : 500;
    const errorCode = createError?.status === 422 ? "email_already_registered" : "signup_failed";
    return NextResponse.json({ error: errorCode }, { status });
  }

  // Consomme le code de façon atomique : si une autre requête l'a déjà
  // pris entre temps (used_by n'est plus null), aucune ligne n'est
  // affectée ci-dessous et on annule la création du compte.
  const { data: claimed, error: claimError } = await service
    .from("invite_codes")
    .update({ used_by: created.user.id, used_at: new Date().toISOString() })
    .eq("code", inviteCode)
    .is("used_by", null)
    .select("code")
    .maybeSingle();

  if (claimError || !claimed) {
    await service.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "invite_code_already_used" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
