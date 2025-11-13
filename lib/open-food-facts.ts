import type { BarcodeProduct } from "@/types";

const OPEN_FOOD_FACTS_BASE_URL = "https://world.openfoodfacts.org/api/v2";
const DEFAULT_USER_AGENT = "CookSnap/0.3 (+https://github.com/jaekop/CookSnap)";

const SUPPORTED_LENGTHS = new Set([8, 12, 13, 14]);

export function normalizeBarcode(input: string | undefined | null): string {
  return (input ?? "").replace(/\D/g, "");
}

export function isSupportedBarcode(value: string): boolean {
  return SUPPORTED_LENGTHS.has(value.length);
}

export async function fetchOpenFoodFactsProduct(upc: string): Promise<BarcodeProduct | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${OPEN_FOOD_FACTS_BASE_URL}/product/${upc}.json`, {
      headers: {
        "User-Agent": process.env.OPEN_FOOD_FACTS_USER_AGENT ?? DEFAULT_USER_AGENT,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Open Food Facts responded with ${response.status}`);
    }

    const payload = (await response.json()) as {
      status: number;
      product?: Record<string, unknown>;
    };

    if (payload.status !== 1 || !payload.product) {
      return null;
    }

    const product = payload.product;
    const cast = product as Record<string, unknown> & {
      product_name?: string;
      brands?: string;
      categories_tags?: string[];
      image_front_small_url?: string;
      image_url?: string;
      quantity?: string;
      nutriments?: Record<string, unknown>;
    };

    return {
      upc,
      name: typeof cast.product_name === "string" ? cast.product_name : null,
      brand: typeof cast.brands === "string" ? cast.brands : null,
      categories: Array.isArray(cast.categories_tags) ? cast.categories_tags : [],
      image: typeof cast.image_front_small_url === "string" ? cast.image_front_small_url : typeof cast.image_url === "string" ? cast.image_url : null,
      quantity: typeof cast.quantity === "string" ? cast.quantity : null,
      nutriments: typeof cast.nutriments === "object" && cast.nutriments ? cast.nutriments : {},
      raw: product,
    };
  } finally {
    clearTimeout(timeout);
  }
}
