/**
 * app/api/internal/cleanup-orphan-accounts/route.ts
 *
 * Depuis que app/auth/callback/route.ts ne supprime plus immédiatement un
 * compte Google créé sans invitation (voir app/invitation-requise), ces
 * comptes orphelins (pas de `profiles`, pas d'`invite_codes.used_by`)
 * restent en base tant que l'utilisateur n'a pas validé de code — y
 * compris s'il ferme l'onglet sans jamais revenir. Ce cron les purge après
 * un délai de grâce, pour ne pas les supprimer sous le nez de quelqu'un
 * encore en train de chercher son code. Déclenché une fois par jour par
 * Vercel Cron (voir vercel.json), même mécanisme de protection que
 * renew-gmail-watches.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { sendAlert } from "@/lib/alert";

export const runtime = "nodejs";
export const maxDuration = 60;

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const service = createServiceSupabase();
  const cutoff = Date.now() - GRACE_PERIOD_MS;

  try {
    const candidateIds: string[] = [];
    let page = 1;
    const perPage = 200;

    // L'API admin ne permet pas de filtrer côté serveur par "pas de
    // profil" : on pagine tous les comptes et on filtre en mémoire (volume
    // attendu faible, produit sur invitation).
    while (true) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage });
      if (error) throw error;

      for (const u of data.users) {
        if (new Date(u.created_at).getTime() < cutoff) {
          candidateIds.push(u.id);
        }
      }

      if (data.users.length < perPage) break;
      page += 1;
    }

    if (candidateIds.length === 0) {
      return NextResponse.json({ deleted: [] });
    }

    const [{ data: profiles }, { data: claimedInvites }] = await Promise.all([
      service.from("profiles").select("id").in("id", candidateIds),
      service.from("invite_codes").select("used_by").in("used_by", candidateIds),
    ]);

    const excluded = new Set([
      ...(profiles ?? []).map((p) => p.id),
      ...(claimedInvites ?? []).map((i) => i.used_by as string),
    ]);

    const orphanIds = candidateIds.filter((id) => !excluded.has(id));
    const deleted: string[] = [];

    for (const id of orphanIds) {
      const { error: deleteError } = await service.auth.admin.deleteUser(id);
      if (deleteError) {
        console.error(`Suppression du compte orphelin ${id} échouée:`, deleteError);
        continue;
      }
      deleted.push(id);
    }

    return NextResponse.json({ deleted });
  } catch (err) {
    console.error("cleanup-orphan-accounts échoué:", err);
    await sendAlert("internal/cleanup-orphan-accounts: échec", err);
    return NextResponse.json({ error: "cleanup_failed" }, { status: 500 });
  }
}
