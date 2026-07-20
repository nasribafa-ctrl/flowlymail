/**
 * app/api/onboarding/route.ts
 *
 * Crée l'entreprise et le profil liés à l'utilisateur connecté. Utilise le
 * client service_role car les tables `entreprise`/`profiles` n'ont pour
 * l'instant que des policies RLS de lecture (voir migration 001) — l'écriture
 * initiale doit donc passer par le serveur, jamais directement depuis le
 * navigateur.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const nomEntreprise = body?.nom_entreprise?.trim();
  if (!nomEntreprise) {
    return NextResponse.json({ error: "nom_entreprise_required" }, { status: 400 });
  }

  const service = createServiceSupabase();

  // Un utilisateur ne doit pas pouvoir refaire l'onboarding une deuxième fois.
  const { data: existingProfile } = await service
    .from("profiles")
    .select("entreprise_id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    return NextResponse.json({ entreprise_id: existingProfile.entreprise_id });
  }

  const { data: entreprise, error: entrepriseError } = await service
    .from("entreprise")
    .insert({ nom: nomEntreprise })
    .select("id")
    .single();

  if (entrepriseError || !entreprise) {
    console.error("Création entreprise échouée:", entrepriseError);
    return NextResponse.json({ error: "entreprise_creation_failed" }, { status: 500 });
  }

  const { error: profileError } = await service.from("profiles").insert({
    id: user.id,
    entreprise_id: entreprise.id,
    role: "owner",
  });

  if (profileError) {
    console.error("Création profil échouée:", profileError);
    return NextResponse.json({ error: "profile_creation_failed" }, { status: 500 });
  }

  await service.from("activity_logs").insert({
    entreprise_id: entreprise.id,
    profile_id: user.id,
    actor_type: "user",
    action: "onboarding_completed",
    metadata: { nom_entreprise: nomEntreprise },
  });

  return NextResponse.json({ entreprise_id: entreprise.id });
}
