import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { claims },
  } = await supabase.auth.getClaims();

  if (!claims) {
    redirect("/login");
  }

  const userId = claims.sub;
  const email = (claims.email as string | undefined) ?? "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader email={email} displayName={profile?.display_name ?? null} />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="container py-6 md:py-8">{children}</div>
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
