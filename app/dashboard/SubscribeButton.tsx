"use client";

import { useState } from "react";

export default function SubscribeButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/stripe/create-checkout-session", { method: "POST" });
    if (!res.ok) {
      setLoading(false);
      setError("Impossible de démarrer l'abonnement. Réessayez dans un instant.");
      return;
    }
    const data = await res.json();
    if (!data.url) {
      setLoading(false);
      setError("Impossible de démarrer l'abonnement. Réessayez dans un instant.");
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button onClick={handleSubscribe} disabled={loading} style={{ padding: 10 }}>
        {loading ? "Redirection..." : "S'abonner - 99€ HT/mois"}
      </button>
    </div>
  );
}
