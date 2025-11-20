import type { StorageCategory } from "@/types";

export const STORAGE_CATEGORY_METADATA: ReadonlyArray<{
  key: StorageCategory;
  label: string;
  description: string;
}> = [
  { key: "dry", label: "Dry storage", description: "Pantry shelves, cabinets, bulk bins." },
  { key: "fridge", label: "Fridge storage", description: "Chilled sections that stay between 34–40°F." },
  { key: "freezer", label: "Freezer storage", description: "Anything frozen or below 32°F." },
] as const;

export const STORAGE_CATEGORY_ORDER = STORAGE_CATEGORY_METADATA.map((entry) => entry.key);

export const DEFAULT_STORAGE_PRESETS = STORAGE_CATEGORY_METADATA.map((entry) => ({
  name: entry.label,
  category: entry.key,
}));

export function getStorageCategoryLabel(category?: StorageCategory | null) {
  const match = STORAGE_CATEGORY_METADATA.find((entry) => entry.key === category);
  return match?.label ?? "Storage";
}

export function normalizeStorageCategory(value?: string | null): StorageCategory | null {
  const key = value?.toLowerCase().trim();
  if (!key) {
    return null;
  }
  if (["ambient", "dry", "pantry", "counter", "shelf"].includes(key)) {
    return "dry";
  }
  if (key.includes("fridge") || key.includes("refrigerator") || key === "cold") {
    return "fridge";
  }
  if (key.includes("freezer") || key === "frozen") {
    return "freezer";
  }
  return null;
}
