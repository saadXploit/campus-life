import "server-only";
import { z } from "zod";

/**
 * Settings that only the SERVER may read.
 * We check them when first needed (not at startup), so the app can still
 * show pages while you are in the middle of setting things up.
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  // Optional on purpose: if it is empty, nobody can become OWNER.
  OWNER_X_USER_ID: z
    .string()
    .regex(/^\d*$/, "OWNER_X_USER_ID must be digits only (the numeric X ID)")
    .optional(),
});

export type ServerEnv = Omit<z.infer<typeof serverEnvSchema>, "OWNER_X_USER_ID"> & {
  OWNER_X_USER_ID: string | undefined;
};

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OWNER_X_USER_ID: process.env.OWNER_X_USER_ID,
  });

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `CAMPUS LIFE settings problem. Check your .env.local file:\n${problems}`
    );
  }

  cached = {
    ...parsed.data,
    // An empty value means "no owner configured", so nobody can become OWNER.
    OWNER_X_USER_ID: parsed.data.OWNER_X_USER_ID || undefined,
  };
  return cached;
}