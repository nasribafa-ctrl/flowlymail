/**
 * app/auth/callback/route.ts
 *
 * Reçoit le retour de Google (via Supabase Auth) après "Continuer avec
 * Google". L'échange du code contre une session DOIT se faire côté
 * serveur (pas depuis une page cliente) : c'est ce que confirme la
 * documentation officielle Supabase pour Next.js App Router — sinon le
 * "code verifier" PKCE stocké en cookie n'est pas retrouvé de façon
 * fiable, d'où l'erreur "PKCE code verifier not found in storage".
 *
 * FlowlyMail fonctionne sur invitation (voir app/api/signup/route.ts) :
 * "Continuer avec Google" ne passe pas par cette vérification et créerait
 * sinon un compte librement — Supabase crée la ligne `auth.users`
 * automatiquement lors de l'échange de code, avant même d'arriver ici.
 *
 * Comme les comptes légitimes n'obtiennent une ligne `profiles` qu'à la
 * fin de l'onboarding, l'absence de `profiles` ne suffit pas à distinguer
 * un tout nouveau compte Google d'un compte invité qui n'a pas terminé son
 * onboarding : on tranche via `invite_codes.used_by`. S'il correspond à cet
 * utilisateur, l'invitation a déjà été consommée légitimement, on le
 * renvoie simplement terminer son onboarding. Sinon, on garde quand même la
 * session (le compte Google vient d'être créé par Supabase pendant
 * l'échange ci-dessus, on ne peut pas revenir en arrière) et on redirige
 * vers /invitation-requise, qui demande le code d'invitation et le
 * consomme pour ce compte (voir app/api/invitation/route.ts) avant de
 * continuer vers /onboarding. Si l'utilisateur abandonne sans valider de
 * code, le compte reste orphelin (pas de profile, pas d'invite consommée)
 * jusqu'à ce que le cron app/api/internal/cleanup-orphan-accounts le
 * supprime.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("Échange du code OAuth échoué:", error);
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("auth_error", "exchange_failed");
      return NextResponse.redirect(loginUrl);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile) {
        const service = createServiceSupabase();
        const { data: invite } = await service
          .from("invite_codes")
          .select("code")
          .eq("used_by", user.id)
          .maybeSingle();

        const destination = invite ? "/onboarding" : "/invitation-requise";
        return NextResponse.redirect(new URL(destination, request.url));
      }
    }
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
