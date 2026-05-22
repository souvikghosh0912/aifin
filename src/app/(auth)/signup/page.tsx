"use client";

import Link from "next/link";
import { useActionState } from "react";

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

import { signUp, type AuthState } from "../actions";

const INITIAL: AuthState = { status: "idle" };

export default function SignupPage() {
  const [state, action, pending] = useActionState(signUp, INITIAL);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Free for personal portfolio tracking. No credit card required.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Name</Label>
            <Input
              id="display_name"
              name="display_name"
              type="text"
              autoComplete="name"
              placeholder="Riya Sharma"
            />
          </div>
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
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </div>
          {state.status === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          {state.status === "info" && (
            <p className="rounded-md bg-muted p-3 text-sm">{state.message}</p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
