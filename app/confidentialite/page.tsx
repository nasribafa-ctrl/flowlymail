export default function ConfidentialitePage() {
  return (
    <div style={{ maxWidth: 720, margin: "60px auto 100px", fontFamily: "sans-serif", lineHeight: 1.6, padding: "0 20px" }}>
      <h1>Politique de confidentialité</h1>
      <p style={{ color: "#666" }}>Dernière mise à jour : 30 juillet 2026</p>

      <h2>1. Qui nous sommes</h2>
      <p>
        FlowlyMail (« nous », « notre ») est un service qui aide les entreprises à
        répondre automatiquement à leurs e-mails clients grâce à l'intelligence
        artificielle. Cette page décrit quelles données nous collectons, pourquoi,
        et comment elles sont protégées.
      </p>

      <h2>2. Données que nous collectons</h2>
      <p>Lorsque vous utilisez FlowlyMail, nous collectons :</p>
      <ul>
        <li>Les informations de votre compte : nom, adresse e-mail, nom de votre entreprise</li>
        <li>Les informations métier que vous renseignez (horaires, services, tarifs) pour permettre à l'IA de répondre correctement</li>
        <li>
          Si vous connectez votre compte Gmail : le contenu des e-mails reçus sur
          l'adresse que vous choisissez de connecter, ainsi que les métadonnées
          associées (expéditeur, objet, date)
        </li>
      </ul>

      <h2>3. Utilisation des données Gmail</h2>
      <p>
        L'accès à votre compte Gmail est utilisé <strong>uniquement</strong> pour :
      </p>
      <ul>
        <li>Lire les e-mails non lus reçus sur l'adresse que vous avez connectée</li>
        <li>Générer, avec une intelligence artificielle, une proposition de réponse basée sur les informations de votre entreprise</li>
        <li>Envoyer cette réponse (directement, ou après votre validation selon le mode choisi)</li>
      </ul>
      <p>
        FlowlyMail n'utilise jamais le contenu de vos e-mails à des fins
        publicitaires, ne les revend à aucun tiers, et ne les partage avec aucune
        autre société. L'usage que nous faisons des données obtenues via les API
        Google respecte la{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
          Politique relative aux données utilisateur des API Google
        </a>
        , y compris les exigences de Limited Use.
      </p>

      <h2>4. Stockage et sécurité</h2>
      <p>
        Les jetons d'accès à votre compte Gmail sont chiffrés (AES-256) avant
        d'être stockés, et ne sont jamais accessibles en clair, y compris par
        notre équipe technique. Chaque entreprise cliente est isolée des autres :
        aucune donnée n'est partagée entre deux comptes FlowlyMail différents.
      </p>

      <h2>5. Conservation des données</h2>
      <p>
        Vos données sont conservées tant que votre compte FlowlyMail est actif.
        Si vous supprimez votre compte ou déconnectez votre Gmail, les jetons
        d'accès associés sont immédiatement invalidés et supprimés de notre base.
      </p>

      <h2>6. Vos droits</h2>
      <p>
        Vous pouvez à tout moment déconnecter votre compte Gmail depuis votre
        tableau de bord, demander la suppression de votre compte, ou nous
        contacter pour toute question concernant vos données, à l'adresse{" "}
        <a href="mailto:contact@flowlymail.fr">contact@flowlymail.fr</a>.
      </p>

      <h2>7. Modifications de cette politique</h2>
      <p>
        Nous pouvons mettre à jour cette politique de confidentialité
        occasionnellement. La date de dernière mise à jour est indiquée en haut
        de cette page.
      </p>

      <h2>8. Contact</h2>
      <p>
        Pour toute question relative à cette politique de confidentialité :{" "}
        <a href="mailto:contact@flowlymail.fr">contact@flowlymail.fr</a>
      </p>
    </div>
  );
}
