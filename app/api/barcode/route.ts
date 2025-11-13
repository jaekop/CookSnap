import { NextResponse } from "next/server";
import { fetchOpenFoodFactsProduct, isSupportedBarcode, normalizeBarcode } from "@/lib/open-food-facts";
import { createSupabaseRouteClient, requireUserId } from "@/lib/supabase";
import type { BarcodeLookupResponse, BarcodeProduct } from "@/types";

const STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SOURCE = "open_food_facts";

type BarcodeCachePayload = {
  found: boolean;
  product: BarcodeProduct | null;
};

type BarcodeCacheRow = {
  upc: string;
  payload: BarcodeCachePayload;
  source: string;
  last_verified_at: string;
  hit_count: number | null;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseRouteClient();
  try {
    await requireUserId(supabase);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }

  let upcInput: string | undefined;
  try {
    const body = await request.json();
    upcInput = typeof body?.upc === "string" ? body.upc : undefined;
  } catch {
    // ignored below
  }

  const normalized = normalizeBarcode(upcInput);
  if (!normalized) {
    return NextResponse.json({ error: "Provide a UPC or EAN" }, { status: 400 });
  }
  if (!isSupportedBarcode(normalized)) {
    return NextResponse.json({ error: "UPC/EAN length must be 8, 12, 13, or 14 digits" }, { status: 400 });
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const freshnessCutoff = now - STALE_AFTER_MS;

  let cacheAvailable = true;
  let cached: BarcodeCacheRow | null = null;

  const { data: cachedData, error: cacheError } = await supabase
    .from("barcode_cache")
    .select("upc,payload,source,last_verified_at,hit_count")
    .eq("upc", normalized)
    .maybeSingle<BarcodeCacheRow>();

  if (cacheError) {
    if (cacheError.code === "42P01") {
      cacheAvailable = false;
    } else {
      return NextResponse.json({ error: cacheError.message }, { status: 400 });
    }
  } else {
    cached = cachedData;
  }

  const cachedTimestamp = cached ? new Date(cached.last_verified_at).getTime() : 0;
  const payload = cached?.payload as BarcodeCachePayload | undefined;

  if (cacheAvailable && cached && cachedTimestamp > freshnessCutoff && payload) {
    const nextHitCount = (cached.hit_count ?? 0) + 1;
    await supabase
      .from("barcode_cache")
      .update({ hit_count: nextHitCount, updated_at: nowIso })
      .eq("upc", normalized);

    const response: BarcodeLookupResponse = {
      upc: normalized,
      source: cached.source,
      found: Boolean(payload.found && payload.product),
      cached: true,
      refreshedAt: cached.last_verified_at,
      product: payload.product,
    };

    return NextResponse.json({ data: response });
  }

  let product: BarcodeProduct | null;
  try {
    product = await fetchOpenFoodFactsProduct(normalized);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }

  const nextPayload: BarcodeCachePayload = {
    found: Boolean(product),
    product,
  };

  if (cacheAvailable) {
    const nextHitCount = (cached?.hit_count ?? 0) + 1;

    const upsertResult = await supabase.from("barcode_cache").upsert({
      upc: normalized,
      payload: nextPayload,
      source: SOURCE,
      last_verified_at: nowIso,
      updated_at: nowIso,
      hit_count: nextHitCount,
      last_error: null,
    });

    if (upsertResult.error && upsertResult.error.code !== "42P01") {
      return NextResponse.json({ error: upsertResult.error.message }, { status: 400 });
    }

    if (upsertResult.error?.code === "42P01") {
      cacheAvailable = false;
    }
  }

  const response: BarcodeLookupResponse = {
    upc: normalized,
    source: cacheAvailable && cached?.source ? cached.source : SOURCE,
    found: Boolean(product),
    cached: false,
    refreshedAt: nowIso,
    product,
  };

  return NextResponse.json({ data: response }, { status: product ? 200 : 404 });
}
