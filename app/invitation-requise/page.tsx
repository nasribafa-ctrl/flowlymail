export default function InvitationRequisePage() {
  return (
    <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Invitation requise</h1>
      <p>
        FlowlyMail fonctionne sur invitation. La connexion avec Google n&apos;est pas
        disponible pour créer un compte : utilisez le code d&apos;invitation qui vous a
        été communiqué pour vous inscrire avec un email et un mot de passe.
      </p>
      <p>
        <a href="/signup">Créer un compte avec un code d&apos;invitation</a>
      </p>
      <p>
        <a href="/login">Retour à la connexion</a>
      </p>
    </div>
  );
}
