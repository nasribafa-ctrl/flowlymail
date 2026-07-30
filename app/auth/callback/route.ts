/**
 * app/auth/callback/route.ts
 *
 * Reçoit le retour de Google (via Supabase Auth) après "Continuer avec
 * Google". L'échange du code contre une session DOIT se faire côté
 * serveur (pas depuis une page cliente) : c'est ce que confirme la
 * documentation officielle Supabase pour Next.js App Router — sinon le
 * "code verifier" PKCE stocké en cookie n'est pas retrouvé de façon
 * fiable, d'où l'erreur "PKCE code verifier not found in storage".
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
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
