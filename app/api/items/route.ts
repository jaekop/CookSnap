import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { riskFor } from "@/lib/risk";
import { createSupabaseRouteClient, requireUserId } from "@/lib/supabase";
import type { Item } from "@/types";

async function resolveHouseholdId(supabase: Awaited<ReturnType<typeof createSupabaseRouteClient>>, userId: string) {
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

export async function GET() {
  const supabase = await createSupabaseRouteClient();
  let userId: string;
  try {
    userId = await requireUserId(supabase);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
  const householdId = await resolveHouseholdId(supabase, userId);

  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("household_id", householdId)
    .order("added_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseRouteClient();
  let userId: string;
  try {
    userId = await requireUserId(supabase);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
  const householdId = await resolveHouseholdId(supabase, userId);

  const payload = await request.json();
  const items = Array.isArray(payload.items) ? payload.items : [payload];

  const inserts = items.map((item) => ({
    name: item.name,
    qty: item.qty ?? 1,
    unit: item.unit ?? null,
    category: item.category ?? null,
    storage: item.storage ?? "ambient",
    barcode: item.barcode ?? null,
    upc_metadata: item.upc_metadata ?? null,
    upc_image_url: item.upc_image_url ?? null,
    opened: item.opened ?? false,
    added_at: new Date().toISOString(),
    last_used_at: null,
    risk_level: "safe",
    user_id: userId,
    household_id: householdId,
  }));

  const { data, error } = await supabase.from("items").insert(inserts).select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const supabase = await createSupabaseRouteClient();
  let userId: string;
  try {
    userId = await requireUserId(supabase);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
  const { id, updates } = await request.json();

  if (!id || !updates) {
    return NextResponse.json({ error: "Missing id or updates" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from("items")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const updatedItem = { ...(existing as Item), ...updates } as Item;
  const nextRisk = riskFor(updatedItem);

  const { data, error } = await supabase
    .from("items")
    .update({ ...updates, risk_level: nextRisk })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseRouteClient();
  let userId: string;
  try {
    userId = await requireUserId(supabase);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "Provide an id" }, { status: 400 });
  }

  const { error } = await supabase.from("items").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 204 });
}
