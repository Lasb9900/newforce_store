import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

export async function getServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        // In Server Components, Next.js may expose a read-only cookie store.
        // Avoid crashing SSR when Supabase tries to refresh auth cookies there.
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignore in read-only contexts (render). Cookies can still be
          // persisted in mutable contexts like Route Handlers/Server Actions.
        }
      },
    },
  });
}

export function getServiceSupabase() {
  if (!env.SUPABASE_URL) {
    throw new Error("Missing SUPABASE_URL for server-side admin client");
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for server-side admin client");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
