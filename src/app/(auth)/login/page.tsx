"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signIn, type AuthState } from "../actions";

const INITIAL: AuthState = { status: "idle" };

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFormFallback() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent className="h-48" />
    </Card>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const [state, action, pending] = useActionState(signIn, INITIAL);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Welcome back. Enter your credentials to access your portfolio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="redirect" value={redirect} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {state.status === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link
              href="/signup"
              className="font-medium text-foreground hover:underline"
            >
              Create an account
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
