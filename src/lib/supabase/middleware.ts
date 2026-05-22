import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/holdings",
  "/transactions",
  "/watchlist",
  "/markets",
  "/insights",
  "/chat",
  "/settings",
];

const AUTH_PAGES = ["/login", "/signup"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const env = serverEnv();
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() verifies JWT signature; safer than getSession() in middleware.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims ?? null;

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (!claims && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (claims && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
