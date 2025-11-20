import { NextResponse } from "next/server";
import { resolveHouseholdId } from "@/lib/households";
import { ensureDefaultStorageLocations, fetchStorageLocations } from "@/lib/storage-server";
import { STORAGE_CATEGORY_METADATA, normalizeStorageCategory } from "@/lib/storage";
import { createSupabaseRouteClient, requireUserId } from "@/lib/supabase";
import type { StorageCategory } from "@/types";

function isValidCategory(value: unknown): value is StorageCategory {
  return typeof value === "string" && STORAGE_CATEGORY_METADATA.some((entry) => entry.key === value);
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
  await ensureDefaultStorageLocations(supabase, householdId);
  await ensureDefaultStorageLocations(supabase, householdId);
  const data = await fetchStorageLocations(supabase, householdId);
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
  await ensureDefaultStorageLocations(supabase, householdId);
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = isValidCategory(body.category) ? body.category : normalizeStorageCategory(body.category) ?? null;

  if (!name) {
    return NextResponse.json({ error: "Provide a storage name" }, { status: 400 });
  }
  if (!category) {
    return NextResponse.json({ error: "Choose a storage category" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("storage_locations")
    .insert({ name, category, household_id: householdId })
    .select("*")
    .maybeSingle();

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

  const householdId = await resolveHouseholdId(supabase, userId);
  const body = await request.json();
  const { id } = body ?? {};
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const categoryValue = body?.category;
  const category = categoryValue === undefined ? undefined : normalizeStorageCategory(categoryValue);

  if (!id) {
    return NextResponse.json({ error: "Provide an id" }, { status: 400 });
  }
  if (!name && category === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) {
    if (!name) {
      return NextResponse.json({ error: "Storage name cannot be empty" }, { status: 400 });
    }
    updates.name = name;
  }
  if (categoryValue !== undefined) {
    if (!category) {
      return NextResponse.json({ error: "Choose a valid category" }, { status: 400 });
    }
    updates.category = category;
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("storage_locations")
    .update(updates)
    .eq("id", id)
    .eq("household_id", householdId)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "Storage not found" }, { status: 404 });
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

  const householdId = await resolveHouseholdId(supabase, userId);
  await ensureDefaultStorageLocations(supabase, householdId);
  const body = await request.json();
  const { id } = body ?? {};

  if (!id) {
    return NextResponse.json({ error: "Provide an id" }, { status: 400 });
  }

  const storages = await fetchStorageLocations(supabase, householdId);
  const target = storages.find((storage) => storage.id === id);

  if (!target) {
    return NextResponse.json({ error: "Storage not found" }, { status: 404 });
  }

  const categoryCount = storages.filter((storage) => storage.category === target.category).length;
  if (categoryCount <= 1) {
    return NextResponse.json({ error: `Keep at least one ${target.category} storage` }, { status: 400 });
  }

  const { error } = await supabase.from("storage_locations").delete().eq("id", id).eq("household_id", householdId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
