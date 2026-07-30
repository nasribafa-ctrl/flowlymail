"use client";

/**
 * app/auth/callback/page.tsx
 *
 * Après "Continuer avec Google", Google renvoie l'utilisateur ici avec un
 * code d'autorisation dans l'URL. Ce code doit être échangé contre une
 * vraie session AVANT de rediriger vers le dashboard.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();

    async function finalizeSession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) {
        setError("Impossible de finaliser la connexion.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    }

    finalizeSession();
  }, [router]);

  if (error) {
    return (
      <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif", textAlign: "center" }}>
        <p style={{ color: "red" }}>{error}</p>
        <a href="/login">Retour à la connexion</a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif", textAlign: "center" }}>
      <p>Connexion en cours…</p>
    </div>
  );
}
