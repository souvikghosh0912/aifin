import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const optionalUrl = optionalString.refine(
  (v) => v === undefined || /^https?:\/\//.test(v),
  { message: "Must be a valid URL" },
);

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  NEXT_PUBLIC_APP_URL: optionalUrl,
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: optionalUrl,
});

const rawClient = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

// Lazily parsed so the absence of envs doesn't crash builds.
let _server: z.infer<typeof serverSchema> | undefined;
let _client: z.infer<typeof clientSchema> | undefined;

export function serverEnv() {
  if (_server) return _server;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid server env:", parsed.error.flatten().fieldErrors);
    throw new Error("Server env validation failed. Check .env.local.");
  }
  _server = parsed.data;
  return _server;
}

export function clientEnv() {
  if (_client) return _client;
  const parsed = clientSchema.safeParse(rawClient);
  if (!parsed.success) {
    console.error("Invalid client env:", parsed.error.flatten().fieldErrors);
    throw new Error("Client env validation failed. Check .env.local.");
  }
  _client = parsed.data;
  return _client;
}

export function hasAi(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
