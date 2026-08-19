const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "2px solid #ddd",
  fontSize: 13,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #eee",
  verticalAlign: "top",
  fontSize: 14,
};

export default function ConfidentialitePage() {
  return (
    <div style={{ maxWidth: 720, margin: "60px auto 100px", fontFamily: "sans-serif", lineHeight: 1.6, padding: "0 20px" }}>
      <h1>Politique de confidentialité — FlowlyMail</h1>
      <p style={{ color: "#666" }}>Dernière mise à jour : 13 août 2026</p>

      <h2>1. Responsable du traitement</h2>
      <p>
        Ahmed Nasri, auto-entrepreneur, SIRET 107 392 250 00018, 8 Rue Henri Dunant,
        31100 Toulouse, France, ci-après « nous » ou « l'Éditeur », est responsable
        du traitement des données décrites dans la présente politique, au sens du
        Règlement Général sur la Protection des Données (RGPD). Pour toute question
        relative à cette politique ou pour exercer vos droits, contactez-nous à{" "}
        <a href="mailto:contact@flowlymail.fr">contact@flowlymail.fr</a>.
      </p>

      <h2>2. Données traitées et finalités</h2>

      <h3>2.1 Données du Client (utilisateur direct de FlowlyMail)</h3>
      <div style={{ overflowX: "auto", margin: "16px 0" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={thStyle}>Donnée</th>
              <th style={thStyle}>Finalité</th>
              <th style={thStyle}>Base légale</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Email, nom de l'entreprise, informations métier</td>
              <td style={tdStyle}>Fourniture du service, personnalisation des réponses IA</td>
              <td style={tdStyle}>Exécution du contrat</td>
            </tr>
            <tr>
              <td style={tdStyle}>Adresse Gmail connectée, jetons d'authentification OAuth (chiffrés)</td>
              <td style={tdStyle}>Accès technique à la boîte Gmail pour lire/répondre aux emails</td>
              <td style={tdStyle}>Exécution du contrat</td>
            </tr>
            <tr>
              <td style={tdStyle}>Données de facturation</td>
              <td style={tdStyle}>Paiement de l'abonnement (traité par Stripe)</td>
              <td style={tdStyle}>Exécution du contrat / obligation légale</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>2.2 Données des correspondants du Client (prospects/clients du Client)</h3>
      <p>
        Dans le cadre du fonctionnement du service, FlowlyMail traite
        automatiquement le contenu des emails reçus par la boîte Gmail
        surveillée (adresse expéditrice, sujet, corps du message), afin de
        générer une réponse pertinente. Le Client reste responsable, en tant
        que responsable de traitement pour ces données, de la licéité de la
        collecte des adresses email traitées ; l'Éditeur agit ici en tant que
        sous-traitant au sens du RGPD pour cette catégorie de données.
      </p>

      <h2>3. Durées de conservation</h2>
      <ul>
        <li>
          Les données des échanges email (validations_en_attente) sont
          anonymisées automatiquement après 90 jours (contenu remplacé,
          métadonnées statistiques conservées)
        </li>
        <li>
          Les jetons d'accès Gmail sont purgés dès la révocation de la
          connexion (status = revoked)
        </li>
        <li>
          L'ensemble des données d'un compte Client (entreprise, comptes
          Gmail, historique) est supprimé 12 mois après résiliation de
          l'abonnement
        </li>
      </ul>

      <h2>4. Destinataires et sous-traitants</h2>
      <p>
        Les données sont hébergées et traitées par les prestataires suivants,
        chacun agissant en tant que sous-traitant :
      </p>
      <div style={{ overflowX: "auto", margin: "16px 0" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={thStyle}>Prestataire</th>
              <th style={thStyle}>Rôle</th>
              <th style={thStyle}>Localisation</th>
              <th style={thStyle}>Garanties</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Render</td>
              <td style={tdStyle}>Hébergement de l'application backend (API + tâches planifiées)</td>
              <td style={tdStyle}>Frankfurt, Allemagne (EU Central)</td>
              <td style={tdStyle}>
                Hébergement en UE ; entreprise américaine soumise au régime des
                transferts internationaux pour l'administration du service,
                encadré par des clauses contractuelles types
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>Supabase</td>
              <td style={tdStyle}>
                Base de données (Postgres) : entreprises, comptes Gmail
                connectés, historique des échanges
              </td>
              <td style={tdStyle}>Paris, France (région AWS eu-west-3)</td>
              <td style={tdStyle}>Hébergement 100% UE, aucun transfert international pour cette donnée</td>
            </tr>
            <tr>
              <td style={tdStyle}>Anthropic (Claude API)</td>
              <td style={tdStyle}>
                Génération des réponses par intelligence artificielle à partir
                du contenu des emails reçus
              </td>
              <td style={tdStyle}>États-Unis</td>
              <td style={tdStyle}>Clauses contractuelles types</td>
            </tr>
            <tr>
              <td style={tdStyle}>Google (Gmail API)</td>
              <td style={tdStyle}>
                Accès à la boîte email du Client, via autorisation OAuth du
                Client (lecture, envoi, labels, brouillons)
              </td>
              <td style={tdStyle}>International</td>
              <td style={tdStyle}>Certifié dans le cadre du programme de conformité Google</td>
            </tr>
            <tr>
              <td style={tdStyle}>Token broker Gmail (application Next.js, hébergée sur Vercel)</td>
              <td style={tdStyle}>
                Gestion du rafraîchissement des jetons OAuth Gmail ; tokens
                chiffrés en base (AES-256-GCM), jamais renvoyés en clair,
                accès protégé par secret partagé
              </td>
              <td style={tdStyle}>Union Européenne (région Vercel Europe)</td>
              <td style={tdStyle}>Hébergement 100% UE</td>
            </tr>
            <tr>
              <td style={tdStyle}>Google Cloud Pub/Sub</td>
              <td style={tdStyle}>
                Notifications de nouvel email (métadonnées uniquement, pas le
                contenu) déclenchant le traitement
              </td>
              <td style={tdStyle}>International</td>
              <td style={tdStyle}>Certifié dans le cadre du programme de conformité Google</td>
            </tr>
            <tr>
              <td style={tdStyle}>Firecrawl</td>
              <td style={tdStyle}>
                Extraction du contenu du site web du Client lors de
                l'inscription, pour pré-remplir automatiquement la
                description de son activité
              </td>
              <td style={tdStyle}>À préciser</td>
              <td style={tdStyle}>—</td>
            </tr>
            <tr>
              <td style={tdStyle}>Sentry</td>
              <td style={tdStyle}>Suivi et diagnostic des erreurs techniques (exceptions applicatives)</td>
              <td style={tdStyle}>À préciser selon la région du projet Sentry configuré</td>
              <td style={tdStyle}>Clauses contractuelles types si hors UE</td>
            </tr>
            <tr>
              <td style={tdStyle}>Stripe</td>
              <td style={tdStyle}>Traitement des paiements (email, moyen de paiement, abonnement)</td>
              <td style={tdStyle}>International</td>
              <td style={tdStyle}>Certifié PCI-DSS, clauses contractuelles types</td>
            </tr>
            <tr>
              <td style={tdStyle}>Hostinger</td>
              <td style={tdStyle}>Hébergement du nom de domaine / DNS</td>
              <td style={tdStyle}>UE</td>
              <td style={tdStyle}>—</td>
            </tr>
            <tr>
              <td style={tdStyle}>n8n</td>
              <td style={tdStyle}>
                Réception des notifications Gmail (webhook) et déclenchement
                du traitement ; ne reçoit que l'identifiant du compte Gmail
                concerné, jamais le contenu des emails
              </td>
              <td style={tdStyle}>
                n8n Cloud (abonnement payant) — infrastructure sous-jacente
                basée sur un fournisseur cloud américain (Azure), données
                généralement stockées en région EU selon la configuration du
                compte
              </td>
              <td style={tdStyle}>Clauses contractuelles types</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Aucune donnée n'est vendue à des tiers. Aucune donnée client n'est
        partagée avec Discord ; le canal d'alerte interne ne reçoit que des
        messages d'erreur technique génériques (contexte + message
        d'erreur), sans contenu d'email ni identifiant personnel.
      </p>

      <h2>5. Transferts hors Union Européenne</h2>
      <p>
        Certains sous-traitants (Anthropic notamment) sont basés aux
        États-Unis. Ces transferts sont encadrés par les clauses
        contractuelles types de la Commission européenne, mécanisme reconnu
        par le RGPD pour les transferts hors UE.
      </p>

      <h2>5bis. Usage des données Google (Gmail) et intelligence artificielle</h2>
      <p>
        Les données issues de votre compte Google (contenu des emails reçus,
        métadonnées) sont utilisées exclusivement pour fournir la
        fonctionnalité principale de FlowlyMail : générer, en temps réel, une
        proposition de réponse à un email entrant. Ces données sont
        transmises à l'API Anthropic (Claude) à cette seule fin.
      </p>
      <p>Nous affirmons explicitement que :</p>
      <ul>
        <li>
          Les données Google (Gmail) ne sont jamais utilisées pour entraîner,
          développer ou améliorer des modèles d'intelligence artificielle ou
          d'apprentissage automatique, qu'ils soient personnalisés ou
          généraux ;
        </li>
        <li>
          Ces données ne sont jamais utilisées à des fins de publicité
          ciblée, de revente à des courtiers de données, d'évaluation de
          solvabilité, ou de constitution de bases de données à d'autres fins
          que la fourniture du service ;
        </li>
        <li>
          Anthropic, notre fournisseur d'IA (API payante, plan standard
          "pay-as-you-go" / Build), n'utilise pas le contenu transmis via son
          API pour entraîner ses propres modèles, conformément à sa politique
          d'utilisation des données API.
        </li>
      </ul>
      <p>
        Déclaration de conformité (« Limited Use ») : l'utilisation des
        données brutes ou dérivées reçues via les API Google Workspace
        respecte la politique Google relative aux données utilisateur, y
        compris les exigences de « Limited Use ». (« The use of raw or
        derived user data received from Workspace APIs will adhere to the
        Google User Data Policy, including the Limited Use requirements. »)
      </p>

      <h2>6. Sécurité</h2>
      <ul>
        <li>Les jetons d'accès Gmail sont stockés chiffrés en base de données</li>
        <li>Les communications entre les différents composants du service sont chiffrées (HTTPS)</li>
        <li>
          L'accès aux routes de validation manuelle est protégé par un jeton
          secret à usage unique, distinct de l'identifiant de la ressource
        </li>
        <li>Un rate-limiting technique protège contre les abus et les tentatives de force brute</li>
      </ul>

      <h2>7. Droits des personnes concernées</h2>
      <p>
        Conformément au RGPD, toute personne concernée (Client ou
        correspondant d'un Client) dispose des droits suivants : accès,
        rectification, effacement, limitation, portabilité, opposition, et,
        le cas échéant, retrait du consentement à tout moment sans affecter
        la licéité du traitement antérieur. Ces droits peuvent être exercés
        en écrivant à{" "}
        <a href="mailto:contact@flowlymail.fr">contact@flowlymail.fr</a>, en
        précisant votre demande et en joignant un justificatif d'identité si
        nécessaire. Nous répondons dans un délai maximal d'un mois.
      </p>
      <p>
        Pour les correspondants d'un Client (destinataires des réponses
        automatiques), la demande doit être adressée en priorité au Client
        concerné (responsable de traitement pour cette relation), ou à
        défaut à l'adresse ci-dessus.
      </p>
      <p>
        Toute personne dispose également du droit d'introduire une
        réclamation auprès de la{" "}
        <a href="https://www.cnil.fr" target="_blank" rel="noreferrer">
          CNIL (www.cnil.fr)
        </a>
        , l'autorité de contrôle compétente en France.
      </p>

      <h2>8. Cookies</h2>
      <p>
        Aucun cookie de suivi publicitaire ou d'analytics n'est utilisé.
        Seuls des cookies strictement nécessaires au fonctionnement du
        service sont posés, exemptés à ce titre de bandeau de consentement
        au sens du RGPD/ePrivacy :
      </p>
      <ul>
        <li>Cookies de session (authentification du Client sur son espace)</li>
        <li>
          Cookie technique anti-CSRF de courte durée (10 minutes), utilisé
          uniquement pendant la procédure de connexion d'un compte Gmail
        </li>
      </ul>

      <h2>9. Contact</h2>
      <p>
        Pour toute question relative à la présente politique ou pour exercer
        vos droits : <a href="mailto:contact@flowlymail.fr">contact@flowlymail.fr</a>
      </p>
    </div>
  );
}
