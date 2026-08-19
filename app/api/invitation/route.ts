/**
 * app/api/invitation/route.ts
 *
 * Consomme un code d'invitation pour un utilisateur déjà authentifié
 * (arrivé ici via app/auth/callback/route.ts après un login Google sans
 * profil ni invitation). Contrairement à app/api/signup/route.ts, le
 * compte auth.users existe déjà : cette route ne fait que valider et
 * marquer le code comme utilisé, la création du `profiles` reste à la
 * charge de /onboarding (voir app/api/onboarding/route.ts), inchangé.
 *
 * Limité à 10 tentatives par heure et par compte (au lieu de par IP comme
 * dans /api/signup) : ici un compte existe déjà à ce stade, donc le
 * limiter par utilisateur a plus de sens et suit le même pattern que
 * generate-infos/route.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";

const RATE_LIMIT_MAX_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const service = createServiceSupabase();

  // Défensif : si un profil existe déjà (ex. onglet resté ouvert après
  // avoir validé le code une première fois), inutile de revalider.
  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    return NextResponse.json({ ok: true });
  }

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error: countError } = await service
    .from("activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("action", "invite_claim_attempt")
    .gte("created_at", windowStart);

  if (countError) {
    console.error("Vérification du quota invite_claim échouée:", countError);
    return NextResponse.json({ error: "rate_limit_check_failed" }, { status: 500 });
  }

  if ((count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", message: "Trop de tentatives. Réessayez dans une heure." },
      { status: 429 }
    );
  }

  await service.from("activity_logs").insert({
    profile_id: user.id,
    actor_type: "user",
    action: "invite_claim_attempt",
  });

  const body = await request.json().catch(() => null);
  const inviteCode = body?.invite_code?.trim();

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

  // Consomme le code de façon atomique, même logique qu'/api/signup : si
  // une autre requête l'a déjà pris entre temps, aucune ligne n'est
  // affectée ci-dessous.
  const { data: claimed, error: claimError } = await service
    .from("invite_codes")
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq("code", inviteCode)
    .is("used_by", null)
    .select("code")
    .maybeSingle();

  if (claimError || !claimed) {
    return NextResponse.json({ error: "invite_code_already_used" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
