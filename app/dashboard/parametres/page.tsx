import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import ParametresForm from "./ParametresForm";

export default async function ParametresPage() {
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
    .select("nom, infos_metier, email_validateur, mode")
    .eq("id", profile.entreprise_id)
    .single();

  if (!entreprise) {
    redirect("/dashboard");
  }

  return (
    <div style={{ maxWidth: 500, margin: "60px auto", fontFamily: "sans-serif" }}>
      <h1>Paramètres</h1>
      <p>Modifiez les informations de votre entreprise.</p>
      <ParametresForm
        initialNom={entreprise.nom || ""}
        initialInfosMetier={entreprise.infos_metier || ""}
        initialEmailValidateur={entreprise.email_validateur || ""}
        initialMode={entreprise.mode === "automatique" ? "automatique" : "validation"}
      />
      <p style={{ marginTop: 24 }}>
        <a href="/dashboard">← Retour au tableau de bord</a>
      </p>
    </div>
  );
}
