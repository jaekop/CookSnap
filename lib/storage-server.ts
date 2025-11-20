import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase";
import { DEFAULT_STORAGE_PRESETS } from "@/lib/storage";
import type { StorageLocation } from "@/types";

export async function ensureDefaultStorageLocations(supabase: SupabaseClient<Database>, householdId: string) {
  const { data: existing, error } = await supabase
    .from("storage_locations")
    .select("id")
    .eq("household_id", householdId)
    .limit(1);

  if (error) {
    throw error;
  }

  if (existing?.length) {
    return;
  }

  await supabase
    .from("storage_locations")
    .insert(
      DEFAULT_STORAGE_PRESETS.map((preset) => ({
        household_id: householdId,
        name: preset.name,
        category: preset.category,
      }))
    );
}

export async function fetchStorageLocations(supabase: SupabaseClient<Database>, householdId: string) {
  const { data, error } = await supabase
    .from("storage_locations")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as StorageLocation[];
}
