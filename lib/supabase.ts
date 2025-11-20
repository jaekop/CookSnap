import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

// Use a permissive Database type until a generated Supabase type is added
export type Database = any;

function requireEnv(variable: string | undefined, name: string): string {
  if (!variable) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return variable;
}

const buildCookieAdapter = (store: ReturnType<typeof cookies>) => ({
  get(name: string) {
    return store.get(name)?.value;
  },
  set(name: string, value: string, options: CookieOptions) {
    try {
      store.set({ name, value, ...options });
    } catch {
      // read-only cookie store in server components
    }
  },
  remove(name: string, options: CookieOptions) {
    try {
      store.set({ name, value: "", ...options, expires: new Date(0) });
    } catch {
      // read-only cookie store in server components
    }
  },
});

export async function createSupabaseServerClient(): Promise<SupabaseClient<Database>> {
  const url = requireEnv(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv(supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const store = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: buildCookieAdapter(store),
  });
}

export async function createSupabaseRouteClient(): Promise<SupabaseClient<Database>> {
  return createSupabaseServerClient();
}

export async function requireUserId(client?: SupabaseClient<Database>): Promise<string> {
  const supabase = client ?? (await createSupabaseServerClient());
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) redirect("/login");
  return user.id;
}
