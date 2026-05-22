import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { serverEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();
  const env = serverEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll called from a Server Component — middleware refreshes the
            // session, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses RLS — use only in trusted server code that
 * needs to read/write the quote_cache table. Never expose to the browser.
 */
export function createServiceClient() {
  const env = serverEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for service-role operations.",
    );
  }
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    },
  );
}
