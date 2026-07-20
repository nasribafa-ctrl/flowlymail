/**
 * lib/supabase/service.ts
 *
 * Client Supabase avec la clé service_role : contourne RLS par design.
 * À utiliser UNIQUEMENT dans du code serveur qui ne s'exécute jamais côté
 * client (Route Handlers, jobs internes). Ne jamais importer ce fichier
 * depuis un composant client ni exposer SUPABASE_SERVICE_ROLE_KEY côté
 * navigateur.
 *
 * Nécessite : npm install @supabase/supabase-js
 */

import { createClient } from "@supabase/supabase-js";

export function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour createServiceSupabase()"
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
