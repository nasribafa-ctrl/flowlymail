"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  // Mémorisé : createBrowserSupabase() est sinon rappelée à chaque rendu,
  // ce qui ferait tourner en boucle le useEffect ci-dessous (dépendance
  // instable) et réarmerait le timeout de secours à chaque frappe.
  const [supabase] = useState(() => createBrowserSupabase());
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error_description") || params.get("error");
    if (urlError) {
      setLinkError("Ce lien de réinitialisation est invalide ou a expiré. Demandez-en un nouveau depuis la page de connexion.");
      return;
    }

    // Si l'échange du code échoue silencieusement (ex. lien ouvert sur un
    // autre navigateur/appareil que celui qui a demandé la réinitialisation
    // — le "code verifier" PKCE est stocké localement), aucun événement ni
    // erreur d'URL n'arrive : sans ce filet, la page resterait bloquée sur
    // "Vérification du lien..." indéfiniment.
    const timeout = setTimeout(() => {
      setLinkError(
        "Impossible de vérifier ce lien. Ouvrez-le depuis le même navigateur que celui utilisé pour demander la réinitialisation, ou demandez-en un nouveau."
      );
    }, 6000);

    function markReady() {
      clearTimeout(timeout);
      setReady(true);
    }

    // Le client Supabase échange automatiquement le code présent dans
    // l'URL contre une session (detectSessionInUrl), puis émet cet
    // événement : on n'affiche le formulaire qu'une fois la session prête.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        markReady();
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady();
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
  }

  if (linkError) {
    return (
      <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
        <h1>Lien invalide</h1>
        <p style={{ color: "red" }}>{linkError}</p>
        <p>
          <a href="/login">Retour à la connexion</a>
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
        <h1>Mot de passe mis à jour</h1>
        <p>Votre mot de passe a bien été modifié.</p>
        <p>
          <a href="/login">Se connecter</a>
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
        <h1>Réinitialisation du mot de passe</h1>
        <p>Vérification du lien...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Nouveau mot de passe</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Nouveau mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />
        <input
          type="password"
          placeholder="Confirmer le mot de passe"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />
        <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
          {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
        </button>
      </form>
    </div>
  );
}
