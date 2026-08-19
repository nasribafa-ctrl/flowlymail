"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function InvitationRequisePage() {
  const router = useRouter();
  const [supabase] = useState(() => createBrowserSupabase());
  const [checking, setChecking] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const errorMessages: Record<string, string> = {
    invalid_invite_code: "Code d'invitation invalide.",
    invite_code_already_used: "Ce code d'invitation a déjà été utilisé.",
    invite_code_required: "Renseignez un code d'invitation.",
    rate_limit_exceeded: "Trop de tentatives. Réessayez dans une heure.",
  };

  useEffect(() => {
    // Cette page suppose une session déjà établie par /auth/callback (login
    // Google sans profil ni invitation) : sans session, rien à valider ici.
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setChecking(false);
    });
  }, [supabase, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_code: inviteCode }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(errorMessages[data.error] || "Une erreur est survenue.");
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  if (checking) {
    return (
      <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
        <h1>Code d'invitation</h1>
        <p>Vérification...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Code d'invitation</h1>
      <p>
        FlowlyMail fonctionne sur invitation. Entrez le code qui vous a été
        communiqué pour finaliser la création de votre compte.
      </p>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Code d'invitation"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          required
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />
        <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
          {loading ? "Validation..." : "Valider"}
        </button>
      </form>
      <p>
        <a href="/login">Retour à la connexion</a>
      </p>
    </div>
  );
}
