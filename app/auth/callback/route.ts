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
 * sinon un compte librement. Comme les comptes légitimes n'obtiennent une
 * ligne `profiles` qu'à la fin de l'onboarding, on ne peut pas distinguer
 * un tout nouveau compte Google d'un compte invité qui n'a pas terminé son
 * onboarding — dans les deux cas on bloque ici et on renvoie vers
 * /invitation-requise ; l'utilisateur légitime peut toujours se connecter
 * via email/mot de passe pour terminer son onboarding.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL("/invitation-requise", request.url));
      }
    }
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
