/**
 * lib/alert.ts
 *
 * Notifie un webhook Discord en cas d'erreur serveur inattendue, pour être
 * alerté sans avoir à surveiller les logs Vercel en continu.
 *
 * N'envoie jamais que context + error.message : jamais l'objet erreur
 * complet (JSON.stringify) ni sa stack, qui peuvent embarquer des données
 * sensibles selon la lib qui l'a levée (ex. réponses d'API tierces
 * contenant des tokens). Best-effort : une erreur ici est avalée après un
 * simple log, pour ne jamais faire échouer l'appelant à cause de l'alerte
 * elle-même.
 */

const MAX_MESSAGE_LENGTH = 1500;

export async function sendAlert(context: string, error: unknown): Promise<void> {
  const webhookUrl = process.env.DISCORD_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const message = error instanceof Error ? error.message : String(error);

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `⚠️ **FlowlyMail** — ${context}\n\`\`\`${message.slice(0, MAX_MESSAGE_LENGTH)}\`\`\``,
      }),
    });
  } catch (alertError) {
    console.error("Envoi de l'alerte Discord échoué:", alertError);
  }
}
