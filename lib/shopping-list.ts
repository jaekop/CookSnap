"use client";

export const SHOPPING_LIST_MANUAL_KEY = "cooksnap-shopping-manual";
export const SHOPPING_LIST_UPDATED_EVENT = "cooksnap-shopping-list-updated";

export interface ShoppingListManualEntry {
  id: string;
  name: string;
  qty?: string;
  unit?: string;
  store?: string;
  note?: string;
  sourceRecipeId?: string;
  sourceRecipeTitle?: string;
  done: boolean;
}

const isBrowser = typeof window !== "undefined";

export function readManualEntries(): ShoppingListManualEntry[] {
  if (!isBrowser) return [];
  try {
    const stored = window.localStorage.getItem(SHOPPING_LIST_MANUAL_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as ShoppingListManualEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function writeManualEntries(entries: ShoppingListManualEntry[]): void {
  if (!isBrowser) return;
  window.localStorage.setItem(SHOPPING_LIST_MANUAL_KEY, JSON.stringify(entries));
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

type IngredientInput = {
  name: string;
  qty?: string | number | null;
  unit?: string | null;
};

export function addRecipeIngredientsToShoppingList(
  recipeId: string,
  recipeTitle: string,
  ingredients: IngredientInput[]
): number {
  if (!isBrowser || !ingredients.length) return 0;
  const existing = readManualEntries();
  const withoutRecipe = existing.filter((entry) => entry.sourceRecipeId !== recipeId);

  const normalized = ingredients.map((ingredient) => {
    const qtyValue =
      ingredient.qty === null || ingredient.qty === undefined || ingredient.qty === ""
        ? undefined
        : typeof ingredient.qty === "number"
        ? String(ingredient.qty)
        : ingredient.qty;

    return {
      id: createId(),
      name: ingredient.name,
      qty: qtyValue,
      unit: ingredient.unit ?? undefined,
      done: false,
      sourceRecipeId: recipeId,
      sourceRecipeTitle: recipeTitle,
    } satisfies ShoppingListManualEntry;
  });

  const updated = [...normalized, ...withoutRecipe];
  writeManualEntries(updated);
  window.dispatchEvent(new CustomEvent(SHOPPING_LIST_UPDATED_EVENT));
  return normalized.length;
}
