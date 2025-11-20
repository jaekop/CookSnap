export type StorageCategory = "dry" | "fridge" | "freezer";

export interface StorageLocation {
  id: string;
  household_id: string;
  name: string;
  category: StorageCategory;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  name: string;
  qty: number;
  unit: string | null;
  category: string | null;
  storage: string | null;
  storage_location_id?: string | null;
  storage_location?: StorageLocation | null;
  barcode: string | null;
  upc_image_url: string | null;
  upc_metadata: BarcodeProduct | null;
  opened: boolean;
  added_at: string;
  last_used_at: string | null;
  risk_level: "safe" | "caution" | "risky" | "use-now";
  user_id: string;
  household_id: string;
}

export interface RecipeIngredient {
  name: string;
  qty: number;
  unit: string;
}

export interface Recipe {
  id: string;
  title: string;
  time_min?: number;
  diet?: string;
  tags: string[];
  ingredients: RecipeIngredient[];
  source_url?: string | null;
  image_url?: string | null;
  instructions?: string | null;
  ner_tokens?: string[];
}

export interface ExternalRecipe {
  id?: string;
  provider: string;
  external_id: string;
  title: string;
  image_url?: string | null;
  source_url?: string | null;
  summary?: string | null;
  instructions?: string | null;
  ingredients: RecipeIngredient[];
  diet_tags: string[];
  total_time?: number | null;
  servings?: number | null;
  last_synced_at: string;
}

export interface BarcodeProduct {
  upc: string;
  name: string | null;
  brand: string | null;
  categories: string[];
  image: string | null;
  quantity: string | null;
  nutriments: Record<string, unknown>;
  raw: Record<string, unknown>;
}

export interface BarcodeLookupResponse {
  upc: string;
  source: string;
  found: boolean;
  cached: boolean;
  refreshedAt: string;
  product: BarcodeProduct | null;
}
