import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PantryItemEditor } from "@/components/PantryItemEditor";
import { RiskBadge } from "@/components/RiskBadge";
import { createSupabaseServerClient, requireUserId } from "@/lib/supabase";
import { ensureDefaultStorageLocations, fetchStorageLocations } from "@/lib/storage-server";
import type { BarcodeProduct, Item } from "@/types";

async function loadItem(id: string) {
  const supabase = await createSupabaseServerClient();
  const userId = await requireUserId(supabase);

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.household_id) {
    return { item: null, storages: [] };
  }

  await ensureDefaultStorageLocations(supabase, membership.household_id);

  const [{ data: item }, storages] = await Promise.all([
    supabase
      .from("items")
      .select("*, storage_location:storage_locations(*)")
      .eq("household_id", membership.household_id)
      .eq("id", id)
      .maybeSingle<Item>(),
    fetchStorageLocations(supabase, membership.household_id),
  ]);

  return { item: item ?? null, storages };
}

interface PantryItemPageProps {
  params: { id: string };
}

export default async function PantryItemPage({ params }: PantryItemPageProps) {
  const { item, storages } = await loadItem(params.id);

  if (!item) {
    notFound();
  }

  const metadata = item.upc_metadata as BarcodeProduct | null;
  const imageUrl = item.upc_image_url ?? metadata?.image ?? null;
  const categories = metadata?.categories?.map((category) => category.replace(/^en:/, "")) ?? [];

  return (
    <div className="space-y-6">
      <Link href="/pantry" className="inline-flex items-center text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]">
        ← Back to pantry
      </Link>
      <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
        <PantryItemEditor item={item} storages={storages} />
        <aside className="space-y-4">
          <div className="space-y-3 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-[rgb(var(--muted-foreground))]">Status</p>
                <p className="text-lg font-semibold">{item.name}</p>
              </div>
              <RiskBadge level={item.risk_level} />
            </div>
            {imageUrl ? (
              <Image src={imageUrl} alt={item.name} width={160} height={160} className="h-40 w-40 rounded-2xl object-cover" unoptimized />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-2xl border border-dashed border-[rgb(var(--border))] text-xs text-[rgb(var(--muted-foreground))]">
                No product image
              </div>
            )}
            <dl className="space-y-2 text-sm text-[rgb(var(--muted-foreground))]">
              {item.barcode ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide">UPC</dt>
                  <dd className="font-mono text-base text-[rgb(var(--foreground))]">{item.barcode}</dd>
                </div>
              ) : null}
              {metadata?.brand ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide">Brand</dt>
                  <dd>{metadata.brand}</dd>
                </div>
              ) : null}
              {metadata?.quantity ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide">Package</dt>
                  <dd>{metadata.quantity}</dd>
                </div>
              ) : null}
              {categories.length ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide">Tags</dt>
                  <dd className="flex flex-wrap gap-2 text-xs">
                    {categories.slice(0, 6).map((category) => (
                      <span key={category} className="rounded-full border border-[rgb(var(--border))] px-2 py-0.5">
                        {category.replace(/-/g, " ")}
                      </span>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
            {metadata?.raw ? (
              <details className="rounded-2xl border border-[rgb(var(--border))]/60 bg-black/5 p-3 text-xs">
                <summary className="cursor-pointer text-[rgb(var(--foreground))]">Raw UPC payload</summary>
                <pre className="mt-2 max-h-48 overflow-auto text-[10px] leading-tight">{JSON.stringify(metadata.raw, null, 2)}</pre>
              </details>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
