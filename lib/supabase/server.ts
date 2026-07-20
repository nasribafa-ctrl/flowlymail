/**
 * lib/supabase/server.ts
 *
 * Client Supabase pour les Route Handlers / Server Components, lié à la
 * session de l'utilisateur connecté (respecte RLS). Next.js 15 rend
 * `cookies()` asynchrone, d'où le `await` et le fait que cette fonction
 * doit elle-même être asynchrone.
 *
 * Nécessite : npm install @supabase/ssr @supabase/supabase-js
 */

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Appelé depuis un Server Component : ignorable si un
            // middleware se charge déjà du rafraîchissement de session.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options, maxAge: 0 });
          } catch {
            // idem
          }
        },
      },
    }
  );
}
