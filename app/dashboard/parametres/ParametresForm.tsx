"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  initialNom: string;
  initialInfosMetier: string;
  initialEmailValidateur: string;
  initialMode: "validation" | "automatique";
}

export default function ParametresForm({
  initialNom,
  initialInfosMetier,
  initialEmailValidateur,
  initialMode,
}: Props) {
  const router = useRouter();
  const [nom, setNom] = useState(initialNom);
  const [infosMetier, setInfosMetier] = useState(initialInfosMetier);
  const [emailValidateur, setEmailValidateur] = useState(initialEmailValidateur);
  const [mode, setMode] = useState<"validation" | "automatique">(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/parametres", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom,
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

    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 460 }}>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>Modifications enregistrées.</p>}

      <label style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
        Nom de l&apos;entreprise
      </label>
      <input
        type="text"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        required
        style={{ width: "100%", padding: 8, marginBottom: 16 }}
      />

      <label style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
        Infos métier
      </label>
      <textarea
        value={infosMetier}
        onChange={(e) => setInfosMetier(e.target.value)}
        required
        rows={6}
        style={{ width: "100%", padding: 8, marginBottom: 16 }}
      />

      <label style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
        Email du validateur
      </label>
      <input
        type="email"
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
          Validation — vous validez chaque réponse avant l&apos;envoi
        </label>
        <label style={{ display: "block", fontSize: 14 }}>
          <input
            type="radio"
            name="mode"
            value="automatique"
            checked={mode === "automatique"}
            onChange={() => setMode("automatique")}
          />{" "}
          Automatique — l&apos;IA répond directement, sans validation
        </label>
      </div>

      <button type="submit" disabled={loading} style={{ padding: 10 }}>
        {loading ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
