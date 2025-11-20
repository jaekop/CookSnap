import { Suspense } from "react";
import { AddManual } from "@/components/AddManual";
import { BarcodeAdd } from "@/components/BarcodeAdd";
import { ReceiptAdd } from "@/components/ReceiptAdd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase";
import { resolveHouseholdId } from "@/lib/households";
import { ensureDefaultStorageLocations, fetchStorageLocations } from "@/lib/storage-server";
import type { StorageLocation } from "@/types";

function SectionHeading({ name }: { name?: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.3em] text-[rgb(var(--muted-foreground))]">{name ? `Thanks, ${name}` : "Add items"}</p>
      <h1 className="text-3xl font-semibold">Keep the pantry flowing</h1>
      <p className="text-sm text-[rgb(var(--muted-foreground))]">
        Snap, scan, or type — CookSnap gives you speed plus confidence.
      </p>
    </div>
  );
}

function Tips() {
  return (
    <aside className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--accent))]/20 p-5 text-sm text-[rgb(var(--muted-foreground))]">
      <h2 className="text-base font-semibold text-[rgb(var(--foreground))]">Tips for accuracy</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>For barcodes, tilt items toward a steady light source.</li>
        <li>For receipts, flatten and crop before uploading.</li>
        <li>Manual adds support quick notes like “opened yesterday”.</li>
      </ul>
    </aside>
  );
}

export default async function AddPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const greetingName = user?.user_metadata?.full_name?.split(" ")[0] ?? user?.email ?? undefined;
  let storageLocations: StorageLocation[] = [];

  if (user) {
    const householdId = await resolveHouseholdId(supabase, user.id);
    await ensureDefaultStorageLocations(supabase, householdId);
    storageLocations = await fetchStorageLocations(supabase, householdId);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
      <div className="space-y-6">
        <SectionHeading name={greetingName} />
        <Tabs defaultValue="barcode" className="rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--accent))]/15 p-6">
          <TabsList>
            <TabsTrigger value="barcode">Barcode</TabsTrigger>
            <TabsTrigger value="receipt">Receipt OCR</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>
          <TabsContent value="barcode">
            <Suspense fallback={<Button disabled>Loading scanner…</Button>}>
              <BarcodeAdd
                defaultStorageId={storageLocations[0]?.id}
                defaultStorageCategory={storageLocations[0]?.category}
              />
            </Suspense>
          </TabsContent>
          <TabsContent value="receipt">
            <ReceiptAdd />
          </TabsContent>
          <TabsContent value="manual">
            <AddManual initialStorages={storageLocations} />
          </TabsContent>
        </Tabs>
      </div>
      <Tips />
    </div>
  );
}
