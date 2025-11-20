import { NextResponse } from "next/server";
import { riskFor } from "@/lib/risk";
import { resolveHouseholdId } from "@/lib/households";
import { ensureDefaultStorageLocations, fetchStorageLocations } from "@/lib/storage-server";
import { normalizeStorageCategory } from "@/lib/storage";
import { createSupabaseRouteClient, requireUserId } from "@/lib/supabase";
import type { Item, StorageCategory, StorageLocation } from "@/types";

function buildStorageLookups(locations: StorageLocation[]) {
  const byId = new Map<string, StorageLocation>();
  const byCategory = new Map<StorageCategory, StorageLocation>();
  for (const location of locations) {
    byId.set(location.id, location);
    if (!byCategory.has(location.category)) {
      byCategory.set(location.category, location);
    }
  }
  return { byId, byCategory, first: locations[0] ?? null };
}

function resolveStorageLocation(
  lookups: ReturnType<typeof buildStorageLookups>,
  requestedId?: string | null,
  requestedCategory?: StorageCategory | null
) {
  if (requestedId) {
    const match = lookups.byId.get(requestedId);
    if (match) {
      return match;
    }
  }
  if (requestedCategory) {
    const match = lookups.byCategory.get(requestedCategory);
    if (match) {
      return match;
    }
  }
  return lookups.first ?? null;
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

  const { data, error } = await supabase
    .from("items")
    .select("*, storage_location:storage_locations(*)")
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
  await ensureDefaultStorageLocations(supabase, householdId);
  const storageLocations = await fetchStorageLocations(supabase, householdId);
  const lookups = buildStorageLookups(storageLocations);

  const payload = await request.json();
  const rawItems = Array.isArray(payload.items) ? payload.items : [payload];
  const items = rawItems as Array<Record<string, any>>;

  const inserts = items.map((item) => {
    const requestedCategory = normalizeStorageCategory(item.storage);
    const requestedLocationId = typeof item.storage_location_id === "string" ? item.storage_location_id : undefined;
    const location = resolveStorageLocation(lookups, requestedLocationId, requestedCategory);
    const storageCategory: StorageCategory = location?.category ?? requestedCategory ?? "dry";
    return {
      name: item.name,
      qty: item.qty ?? 1,
      unit: item.unit ?? null,
      category: item.category ?? null,
      storage: storageCategory,
      storage_location_id: location?.id ?? lookups.first?.id ?? null,
      barcode: item.barcode ?? null,
      upc_metadata: item.upc_metadata ?? null,
      upc_image_url: item.upc_image_url ?? null,
      opened: item.opened ?? false,
      added_at: new Date().toISOString(),
      last_used_at: null,
      risk_level: "safe",
      user_id: userId,
      household_id: householdId,
    };
  });

  const { data, error } = await supabase.from("items").insert(inserts).select("*, storage_location:storage_locations(*)");

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
  const { id, ids, updates } = await request.json();

  if ((!id && !ids?.length) || !updates) {
    return NextResponse.json({ error: "Missing id(s) or updates" }, { status: 400 });
  }


  // Bulk move: allow changing storage on many items at once
  if (Array.isArray(ids) && ids.length) {
    const storageIdProvided = Object.hasOwn(updates, "storage_location_id");
    const storageKeyProvided = Object.hasOwn(updates, "storage");
    if (!storageIdProvided && !storageKeyProvided) {
      return NextResponse.json({ error: "Bulk updates must target storage" }, { status: 400 });
    }

    const { data: firstItem, error: firstError } = await supabase
      .from("items")
      .select("household_id")
      .eq("id", ids[0])
      .eq("user_id", userId)
      .maybeSingle();

    if (firstError) {
      return NextResponse.json({ error: firstError.message }, { status: 400 });
    }
    if (!firstItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await ensureDefaultStorageLocations(supabase, firstItem.household_id);
    const storageLocations = await fetchStorageLocations(supabase, firstItem.household_id);
    const lookups = buildStorageLookups(storageLocations);

    const requestedId =
      storageIdProvided && typeof updates.storage_location_id === "string" ? updates.storage_location_id : undefined;
    const requestedCategory = storageKeyProvided ? normalizeStorageCategory(updates.storage) : null;
    const location = resolveStorageLocation(lookups, requestedId, requestedCategory);

    const updatePayload = {
      storage: location?.category ?? requestedCategory ?? null,
      storage_location_id: location?.id ?? null,
    };

    const { data, error } = await supabase
      .from("items")
      .update(updatePayload)
      .in("id", ids)
      .eq("user_id", userId)
      .select("*, storage_location:storage_locations(*)");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
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

  const existingItem = existing as Item;
  const updatedPayload: Record<string, unknown> = { ...updates };
  const hasStorageUpdate = Object.hasOwn(updates, "storage_location_id") || Object.hasOwn(updates, "storage");

  if (hasStorageUpdate) {
    await ensureDefaultStorageLocations(supabase, existingItem.household_id);
    const storageLocations = await fetchStorageLocations(supabase, existingItem.household_id);
    const lookups = buildStorageLookups(storageLocations);
    const storageIdProvided = Object.hasOwn(updates, "storage_location_id");
    const storageKeyProvided = Object.hasOwn(updates, "storage");
    const requestedId =
      storageIdProvided && typeof updates.storage_location_id === "string" ? updates.storage_location_id : undefined;
    const requestedCategory = storageKeyProvided ? normalizeStorageCategory(updates.storage) : null;
    const location =
      storageIdProvided && updates.storage_location_id === null && !requestedCategory
        ? null
        : resolveStorageLocation(lookups, requestedId, requestedCategory);

    if (storageIdProvided) {
      updatedPayload.storage_location_id = location?.id ?? (updates.storage_location_id === null ? null : existingItem.storage_location_id ?? null);
    } else if (location) {
      updatedPayload.storage_location_id = location.id;
    }

    const fallbackCategory =
      location?.category ?? requestedCategory ?? normalizeStorageCategory(existingItem.storage) ?? "dry";
    updatedPayload.storage = fallbackCategory;
  }

  const sanitizedUpdates = Object.fromEntries(Object.entries(updatedPayload).filter(([, value]) => value !== undefined));
  const updatedItem = { ...existingItem, ...sanitizedUpdates } as Item;
  const nextRisk = riskFor(updatedItem);

  const { data, error } = await supabase
    .from("items")
    .update({ ...sanitizedUpdates, risk_level: nextRisk })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*, storage_location:storage_locations(*)")
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
