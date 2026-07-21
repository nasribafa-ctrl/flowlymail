"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [infosMetier, setInfosMetier] = useState("");
  const [emailValidateur, setEmailValidateur] = useState("");
  const [mode, setMode] = useState<"validation" | "automatique">("validation");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!siteUrl.trim()) {
      setGenerateError("Renseignez d'abord l'adresse de votre site.");
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    const res = await fetch("/api/onboarding/generate-infos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: siteUrl }),
    });
    setGenerating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setGenerateError(
        data.error === "site_fetch_failed"
          ? "Impossible d'accéder à ce site. Vérifiez l'adresse ou remplissez le champ manuellement."
          : "La génération automatique a échoué. Vous pouvez remplir le champ manuellement."
      );
      return;
    }
    const data = await res.json();
    setInfosMetier(data.infos_metier);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom_entreprise: nom,
        infos_metier: infosMetier,
        email_validateur: emailValidateur,
        mode,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Une erreur est survenue");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 460, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>Bienvenue sur FlowlyMail 👋</h1>
      <p>Quelques infos pour que l'IA réponde correctement à vos clients.</p>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
          Nom de l'entreprise
        </label>
        <input
          type="text"
          placeholder="Ex. Agence Horizon"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
          style={{ width: "100%", padding: 8, marginBottom: 16 }}
        />

        <label style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
          Adresse de votre site web (optionnel)
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <input
            type="text"
            placeholder="www.mon-entreprise.fr"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            style={{ flex: 1, padding: 8 }}
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            style={{ padding: "8px 12px", whiteSpace: "nowrap" }}
          >
            {generating ? "Génération..." : "Générer automatiquement"}
          </button>
        </div>
        {generateError && (
          <p style={{ color: "red", fontSize: 12, marginTop: 0 }}>{generateError}</p>
        )}
        <p style={{ fontSize: 12, color: "#666", marginTop: 4, marginBottom: 8 }}>
          On lit votre site et on prérédige le champ ci-dessous. Relisez et corrigez avant de continuer.
        </p>

        <label style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
          Infos métier (horaires, services proposés, etc.)
        </label>
        <textarea
          placeholder="Ex. Ouvert du lundi au vendredi 9h-18h. Nous proposons..."
          value={infosMetier}
          onChange={(e) => setInfosMetier(e.target.value)}
          required
          rows={6}
          style={{ width: "100%", padding: 8, marginBottom: 16 }}
        />

        <label style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
          Email du validateur
        </label>
        <p style={{ fontSize: 12, color: "#666", marginTop: -4, marginBottom: 4 }}>
          C'est à cette adresse que les réponses proposées par l'IA seront envoyées pour validation.
        </p>
        <input
          type="email"
          placeholder="vous@entreprise.fr"
          value={emailValidateur}
          onChange={(e) => setEmailValidateur(e.target.value)}
          required
          style={{ width: "100%", padding: 8, marginBottom: 16 }}
        />

        <label style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
          Mode de fonctionnement
        </label>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
            <input
              type="radio"
              name="mode"
              value="validation"
              checked={mode === "validation"}
              onChange={() => setMode("validation")}
            />{" "}
            Validation — vous validez chaque réponse avant l'envoi
          </label>
          <label style={{ display: "block", fontSize: 14 }}>
            <input
              type="radio"
              name="mode"
              value="automatique"
              checked={mode === "automatique"}
              onChange={() => setMode("automatique")}
            />{" "}
            Automatique — l'IA répond directement, sans validation
          </label>
        </div>

        <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
          {loading ? "Création..." : "Continuer"}
        </button>
      </form>
    </div>
  );
}
