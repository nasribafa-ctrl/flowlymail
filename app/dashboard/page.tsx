import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import SubscribeButton from "./SubscribeButton";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { gmail?: string; gmail_error?: string; payment?: string };
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("entreprise_id")
    .eq("id", user.id)
    .single();

  if (!profile?.entreprise_id) {
    redirect("/onboarding");
  }

  const { data: entreprise } = await supabase
    .from("entreprise")
    .select("stripe_subscription_status")
    .eq("id", profile.entreprise_id)
    .single();

  const { data: gmailAccounts } = await supabase
    .from("gmail_accounts")
    .select("email_surveille, status, connected_at")
    .eq("entreprise_id", profile.entreprise_id);

  const account = gmailAccounts?.[0];
  const subscriptionActive = entreprise?.stripe_subscription_status === "active";

  return (
    <div style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Tableau de bord</h1>
        <a href="/dashboard/parametres">Paramètres</a>
      </div>

      {searchParams.gmail === "connected" && (
        <p style={{ color: "green" }}>Gmail connecté avec succès.</p>
      )}
      {searchParams.gmail_error && (
        <p style={{ color: "red" }}>Erreur de connexion Gmail : {searchParams.gmail_error}</p>
      )}
      {searchParams.payment === "success" && subscriptionActive && (
        <p style={{ color: "green" }}>Abonnement actif.</p>
      )}
      {searchParams.payment === "success" && !subscriptionActive && (
        <p style={{ color: "green" }}>Abonnement en cours d&apos;activation...</p>
      )}
      {searchParams.payment === "cancelled" && (
        <p style={{ color: "#b45309" }}>Abonnement annulé.</p>
      )}

      {!subscriptionActive && <SubscribeButton />}

      {account ? (
        <div>
          <p>
            Compte Gmail : <strong>{account.email_surveille}</strong>
          </p>
          <p>Statut : {account.status}</p>
          {account.status !== "active" && (
            <div>
              <p style={{ color: "#b45309" }}>
                L&apos;accès à ce compte Gmail a été révoqué ou a expiré. Reconnectez-le
                pour continuer à recevoir les réponses de l&apos;IA.
              </p>
              <a href="/api/gmail/connect">
                <button style={{ padding: 10 }}>Reconnecter Gmail</button>
              </a>
            </div>
          )}
        </div>
      ) : (
        <div>
          <p>Aucun compte Gmail connecté.</p>
          <a href="/api/gmail/connect">
            <button style={{ padding: 10 }}>Connecter Gmail</button>
          </a>
        </div>
      )}
    </div>
  );
}
