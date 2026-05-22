import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function updateProfile(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const {
    data: { claims },
  } = await supabase.auth.getClaims();
  if (!claims) redirect("/login");

  const displayName = String(formData.get("display_name") ?? "").trim();
  await supabase
    .from("profiles")
    .update({ display_name: displayName || null })
    .eq("id", claims.sub);
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { claims },
  } = await supabase.auth.getClaims();
  if (!claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, base_currency, created_at")
    .eq("id", claims.sub)
    .maybeSingle();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile and preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            How you appear inside finai.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={(claims.email as string | undefined) ?? ""}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                name="display_name"
                defaultValue={profile?.display_name ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Base currency</Label>
              <Input
                id="currency"
                value={profile?.base_currency ?? "INR"}
                disabled
              />
              <p className="text-xs text-muted-foreground">
                INR-only for now. Multi-currency support is on the roadmap.
              </p>
            </div>
            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
