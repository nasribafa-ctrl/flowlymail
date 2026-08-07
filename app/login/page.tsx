"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleForgotPassword() {
    setError(null);
    setResetSent(false);
    if (!email) {
      setError("Renseignez votre email ci-dessus, puis cliquez à nouveau sur ce lien.");
      return;
    }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setResetSent(true);
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Connexion FlowlyMail</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {resetSent && (
        <p style={{ color: "green" }}>
          Si un compte existe pour cet email, un lien de réinitialisation vient d&apos;être envoyé.
        </p>
      )}
      <button onClick={handleGoogleLogin} style={{ width: "100%", padding: 10, marginBottom: 16 }}>
        Continuer avec Google
      </button>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />
        <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
      <p>
        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={resetLoading}
          style={{ background: "none", border: "none", padding: 0, color: "#2563eb", cursor: "pointer" }}
        >
          {resetLoading ? "Envoi..." : "Mot de passe oublié ?"}
        </button>
      </p>
      <p>
        Pas de compte ? <a href="/signup">Créer un compte</a>
      </p>
    </div>
  );
}
