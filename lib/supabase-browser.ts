"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY;

// Use a permissive Database type until a generated Supabase type is added
type Database = any;

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  const url = requireEnv(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv(supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createBrowserClient<Database>(url, key);
}
