import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PantryWorkspace } from "@/components/PantryWorkspace";
import { createSupabaseServerClient, requireUserId } from "@/lib/supabase";
import { resolveHouseholdId } from "@/lib/households";
import { ensureDefaultStorageLocations, fetchStorageLocations } from "@/lib/storage-server";
import type { Item, StorageLocation } from "@/types";

async function loadPantry() {
  const supabase = await createSupabaseServerClient();
  try {
    const userId = await requireUserId(supabase);
    const householdId = await resolveHouseholdId(supabase, userId);
    await ensureDefaultStorageLocations(supabase, householdId);

    const [itemsResult, storages] = await Promise.all([
      supabase
        .from("items")
        .select("*, storage_location:storage_locations(*)")
        .eq("household_id", householdId)
        .order("added_at", { ascending: false }),
      fetchStorageLocations(supabase, householdId),
    ]);

    if (itemsResult.error) {
      throw itemsResult.error;
    }

    return { items: (itemsResult.data ?? []) as Item[], storages };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export default async function PantryPage() {
  const data = await loadPantry();

  if (data.error) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--accent))]/20 p-10 text-center">
        <h1 className="text-2xl font-semibold">Sign in to view your pantry</h1>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          CookSnap syncs directly with your Supabase household. Once you sign in, everything updates in real time.
        </p>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  const { items } = data;
  const storages = data.storages ?? ([] as StorageLocation[]);

  return (
    <div className="space-y-6">
      <PantryWorkspace initialItems={items} initialStorages={storages} />
    </div>
  );
}
