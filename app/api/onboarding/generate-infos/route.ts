/**
 * app/api/onboarding/generate-infos/route.ts
 *
 * Reçoit l'URL du site d'un client, récupère son contenu, et demande à
 * Claude de le résumer en une description métier exploitable par l'agent
 * IA de FlowlyMail. Limité à 5 utilisations par compte et par 24h : cette
 * route consomme des crédits Anthropic à chaque appel, et n'importe quel
 * compte inscrit (l'inscription elle-même est libre) pourrait sinon
 * l'utiliser sans limite.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";

export const runtime = "nodejs";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1/scrape";
const MAX_PAGE_TEXT_CHARS = 6000;
const FETCH_TIMEOUT_MS = 10000;
const RATE_LIMIT_MAX_CALLS = 5;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function normalizeUrl(input: string): string | null {
  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const url = new URL(withProtocol);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Variable d'environnement manquante: ANTHROPIC_API_KEY");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  if (!process.env.FIRECRAWL_API_KEY) {
    console.error("Variable d'environnement manquante: FIRECRAWL_API_KEY");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const service = createServiceSupabase();
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const { count, error: countError } = await service
    .from("activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("action", "ai_infos_generated")
    .gte("created_at", windowStart);

  if (countError) {
    console.error("Vérification du quota échouée:", countError);
    return NextResponse.json({ error: "rate_limit_check_failed" }, { status: 500 });
  }

  if ((count ?? 0) >= RATE_LIMIT_MAX_CALLS) {
    return NextResponse.json(
      {
        error: "rate_limit_exceeded",
        message: `Limite de ${RATE_LIMIT_MAX_CALLS} générations par 24h atteinte. Réessayez plus tard ou remplissez le champ manuellement.`,
      },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const rawUrl = body?.url?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "url_required" }, { status: 400 });
  }

  const url = normalizeUrl(rawUrl);
  if (!url) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }

  let pageText: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const firecrawlResponse = await fetch(FIRECRAWL_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    clearTimeout(timeout);

    if (!firecrawlResponse.ok) {
      const detail = await firecrawlResponse.text();
      console.error("Appel Firecrawl échoué:", detail);
      return NextResponse.json({ error: "site_fetch_failed" }, { status: 502 });
    }

    const firecrawlResult = await firecrawlResponse.json();
    const markdown = firecrawlResult?.data?.markdown;
    if (typeof markdown !== "string") {
      console.error("Réponse Firecrawl inattendue:", firecrawlResult);
      return NextResponse.json({ error: "site_fetch_failed" }, { status: 502 });
    }
    pageText = markdown.slice(0, MAX_PAGE_TEXT_CHARS);
  } catch (err) {
    console.error("Récupération du site échouée:", err);
    return NextResponse.json({ error: "site_fetch_failed" }, { status: 502 });
  }

  if (!pageText || pageText.length < 30) {
    return NextResponse.json({ error: "site_content_empty" }, { status: 422 });
  }

  const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Voici le contenu brut extrait du site web d'une entreprise :\n\n${pageText}\n\nRédige en français un texte court et factuel décrivant cette entreprise, destiné à être donné à une IA qui répond aux e-mails clients à sa place. Inclus si l'information est présente : ce que fait l'entreprise, ses horaires, ses services ou produits principaux, ses tarifs. N'invente rien : si une information ne figure pas dans le texte source, ne la mentionne pas. Réponds uniquement avec le texte final, sans préambule ni commentaire.`,
        },
      ],
    }),
  });

  if (!anthropicResponse.ok) {
    const detail = await anthropicResponse.text();
    console.error("Appel Anthropic échoué:", detail);
    return NextResponse.json({ error: "ai_generation_failed" }, { status: 502 });
  }

  const result = await anthropicResponse.json();
  const infosMetier = result?.content
    ?.filter((block: { type: string }) => block.type === "text")
    .map((block: { text: string }) => block.text)
    .join("\n")
    .trim();

  if (!infosMetier) {
    return NextResponse.json({ error: "ai_generation_empty" }, { status: 502 });
  }

  await service.from("activity_logs").insert({
    profile_id: user.id,
    actor_type: "user",
    action: "ai_infos_generated",
    metadata: { url },
  });

  return NextResponse.json({ infos_metier: infosMetier });
}
