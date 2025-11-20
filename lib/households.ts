import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase";

/**
 * Ensures the current user has a household row and membership.
 * Creates both records on the fly when missing to keep onboarding frictionless.
 */
export async function resolveHouseholdId(supabase: SupabaseClient<Database>, userId: string) {
  const fetchMembership = async () =>
    supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .maybeSingle();

  const { data: membership } = await fetchMembership();
  if (membership?.household_id) {
    return membership.household_id;
  }

  const newHouseholdId = randomUUID();
  const { error: householdError } = await supabase.from("households").insert({ id: newHouseholdId, name: "CookSnap household" });

  if (householdError) {
    if (householdError.code === "42501") {
      throw new Error(
        "Household setup is blocked by RLS. Run docs/supabase.sql in your Supabase project (or allow inserts on public.households) before adding items."
      );
    }
    const { data: retryMembership } = await fetchMembership();
    if (retryMembership?.household_id) {
      return retryMembership.household_id;
    }
    throw householdError ?? new Error("Unable to create household");
  }

  const { error: membershipError } = await supabase.from("household_members").insert({
    household_id: newHouseholdId,
    user_id: userId,
  });

  if (membershipError && membershipError.code !== "23505") {
    throw membershipError;
  }

  return newHouseholdId;
}
