import Link from "next/link";
import { Button } from "@/components/ui/button";
import baseRecipes from "@/data/recipes.json";
import { createSupabaseServerClient, requireUserId } from "@/lib/supabase";
import type { Item, Recipe } from "@/types";
import { RecipesClient } from "@/components/RecipesClient";
import { getRandomOpenRecipes, getBestPantryMatches, getUseNowRecipes } from "@/lib/open-recipes";

async function loadContext() {
  const supabase = await createSupabaseServerClient();
  try {
    const userId = await requireUserId(supabase);
    const membershipPromise = supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .maybeSingle();

    const dbRecipesPromise = supabase.from("recipes").select("*").order("time_min", { ascending: true });

    const [{ data: membership }, { data: dbRecipes = [] }] = await Promise.all([membershipPromise, dbRecipesPromise]);

    const householdId = membership?.household_id ?? null;

    let items: Item[] = [];
    if (householdId) {
      const { data: householdItems } = await supabase.from("items").select("*").eq("household_id", householdId);
      items = (householdItems ?? []) as Item[];
    }

    const [featured, pantryMatches, useNow] = await Promise.all([
      getRandomOpenRecipes(10),
      getBestPantryMatches(items, 4),
      getUseNowRecipes(items, 4),
    ]);
    const datasetAvailable = featured.length > 0;

    const fallbackRecipes: Recipe[] = dbRecipes.length ? (dbRecipes as Recipe[]) : (baseRecipes as Recipe[]);
    const displayFeatured = datasetAvailable ? featured : fallbackRecipes.slice(0, 10);
    const displayPantryMatches = datasetAvailable ? pantryMatches : [];
    const displayUseNow = datasetAvailable ? useNow : [];

    return { items, featured: displayFeatured, pantryMatches: displayPantryMatches, useNow: displayUseNow, fallbackRecipes, datasetAvailable };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export default async function RecipesPage() {
  const context = await loadContext();

  if (context.error) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--accent))]/20 p-10 text-center">
        <h1 className="text-2xl font-semibold">Use-it-now recipes, once you sign in</h1>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          Sign in to unlock personalized recommendations built from your pantry timeline.
        </p>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  const { items, featured, pantryMatches, useNow, fallbackRecipes, datasetAvailable } = context;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Use-it-now recipes</h1>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          Sorted by how much near-expiry inventory they rescue. Dial in diet, tags, cook time, or search for anything in your cravings list.
        </p>
      </header>
      <RecipesClient
        items={items}
        featured={featured}
        pantryMatches={pantryMatches}
        useNow={useNow}
        fallbackRecipes={fallbackRecipes}
        datasetAvailable={datasetAvailable}
      />
    </div>
  );
}
