import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { gmail?: string; gmail_error?: string };
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

  const { data: gmailAccounts } = await supabase
    .from("gmail_accounts")
    .select("email_surveille, status, connected_at")
    .eq("entreprise_id", profile.entreprise_id);

  const account = gmailAccounts?.[0];

  return (
    <div style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Tableau de bord</h1>

      {searchParams.gmail === "connected" && (
        <p style={{ color: "green" }}>Gmail connecté avec succès.</p>
      )}
      {searchParams.gmail_error && (
        <p style={{ color: "red" }}>Erreur de connexion Gmail : {searchParams.gmail_error}</p>
      )}

      {account ? (
        <div>
          <p>
            Compte Gmail : <strong>{account.email_surveille}</strong>
          </p>
          <p>Statut : {account.status}</p>
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
