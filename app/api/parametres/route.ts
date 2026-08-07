/**
 * app/api/parametres/route.ts
 *
 * Permet à un utilisateur connecté de modifier les informations de SA
 * propre entreprise (nom, infos métier, email validateur, mode). Vérifie
 * systématiquement que l'entreprise ciblée est bien la sienne avant
 * d'écrire quoi que ce soit.
 *
 * Limitée à 20 modifications par compte et par heure (comptage via
 * activity_logs, même logique que generate-infos/route.ts) : chaque
 * mise à jour réussie logue déjà une ligne "entreprise_updated", on la
 * réutilise directement pour le comptage.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";

const RATE_LIMIT_MAX_UPDATES = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("entreprise_id")
    .eq("id", user.id)
    .single();

  if (!profile?.entreprise_id) {
    return NextResponse.json({ error: "no_entreprise" }, { status: 400 });
  }

  const service = createServiceSupabase();
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const { count, error: countError } = await service
    .from("activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("action", "entreprise_updated")
    .gte("created_at", windowStart);

  if (countError) {
    console.error("Vérification du quota paramètres échouée:", countError);
    return NextResponse.json({ error: "rate_limit_check_failed" }, { status: 500 });
  }

  if ((count ?? 0) >= RATE_LIMIT_MAX_UPDATES) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: `Limite de ${RATE_LIMIT_MAX_UPDATES} modifications par heure atteinte. Réessayez plus tard.`,
      },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const nom = body?.nom?.trim();
  const infosMetier = body?.infos_metier?.trim();
  const emailValidateur = body?.email_validateur?.trim();
  const mode = body?.mode === "automatique" ? "automatique" : "validation";

  if (!nom) {
    return NextResponse.json({ error: "nom_required" }, { status: 400 });
  }
  if (!infosMetier) {
    return NextResponse.json({ error: "infos_metier_required" }, { status: 400 });
  }
  if (!emailValidateur) {
    return NextResponse.json({ error: "email_validateur_required" }, { status: 400 });
  }

  const { error: updateError } = await service
    .from("entreprise")
    .update({
      nom,
      infos_metier: infosMetier,
      email_validateur: emailValidateur,
      mode,
    })
    .eq("id", profile.entreprise_id);

  if (updateError) {
    console.error("Mise à jour entreprise échouée:", updateError);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  await service.from("activity_logs").insert({
    entreprise_id: profile.entreprise_id,
    profile_id: user.id,
    actor_type: "user",
    action: "entreprise_updated",
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
