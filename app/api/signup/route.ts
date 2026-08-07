/**
 * app/api/signup/route.ts
 *
 * Crée un compte utilisateur, mais uniquement si un code d'invitation
 * valide et non utilisé est fourni (table `invite_codes`). L'inscription
 * libre (supabase.auth.signUp côté client) est volontairement remplacée
 * par cette route serveur : la vérification et la consommation du code
 * doivent se faire avec la clé service_role, hors de portée du client.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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

  const service = createServiceSupabase();

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
