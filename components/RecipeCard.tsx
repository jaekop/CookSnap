"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { Item, Recipe } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { addRecipeIngredientsToShoppingList } from "@/lib/shopping-list";

interface RecipeCardProps {
  recipe: Recipe;
  pantryItems?: Item[];
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const EMPTY_PANTRY_ITEMS: Item[] = [];

export function RecipeCard({ recipe, pantryItems }: RecipeCardProps) {
  const resolvedPantryItems = pantryItems ?? EMPTY_PANTRY_ITEMS;
  const pantrySet = useMemo(() => new Set(resolvedPantryItems.map((item) => normalize(item.name))), [resolvedPantryItems]);
  const ingredientTokens = useMemo(() => {
    if (recipe.ner_tokens?.length) {
      return recipe.ner_tokens.map((token) => normalize(token));
    }
    return recipe.ingredients.map((ingredient) => normalize(ingredient.name));
  }, [recipe]);
  const ownedCount = ingredientTokens.filter((token) => pantrySet.has(token)).length;
  const missing = Math.max(ingredientTokens.length - ownedCount, 0);
  const missingIngredients = useMemo(
    () => recipe.ingredients.filter((ingredient) => !pantrySet.has(normalize(ingredient.name))),
    [recipe.ingredients, pantrySet]
  );
  const [added, setAdded] = useState(false);

  const handleAddIngredients = () => {
    if (!missingIngredients.length) return;
    addRecipeIngredientsToShoppingList(recipe.id, recipe.title, missingIngredients);
    setAdded(true);
  };

  return (
    <Card className="h-full overflow-hidden bg-[rgb(var(--accent))]/10">
      {recipe.image_url ? (
        <div className="h-40 w-full overflow-hidden">
          <Image src={recipe.image_url} alt={recipe.title} width={640} height={320} className="h-full w-full object-cover" />
        </div>
      ) : null}
      <CardHeader>
        <CardTitle className="text-base">{recipe.title}</CardTitle>
        <p className="text-xs uppercase tracking-[0.3em] text-[rgb(var(--muted-foreground))]">{recipe.tags.join(" · ")}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-[rgb(var(--muted-foreground))]">
        <p>
          {recipe.time_min ?? 20} min · {recipe.diet ?? "any"}
        </p>
        <p className="text-xs text-[rgb(var(--foreground))]">
          {ownedCount}/{ingredientTokens.length} pantry matches · {missing > 0 ? `Missing ${missing}` : "Ready to cook"}
        </p>
        <ul className="mt-1 list-disc pl-4">
          {recipe.ingredients.slice(0, 4).map((ingredient) => {
            const available = pantrySet.has(normalize(ingredient.name));
            return (
              <li key={`${recipe.id}-${ingredient.name}`} className={available ? "text-[rgb(var(--foreground))]" : undefined}>
                {ingredient.qty} {ingredient.unit} {ingredient.name}
              </li>
            );
          })}
        </ul>
        {recipe.source_url ? (
          <Button asChild variant="outline" className="mt-2 w-full text-xs">
            <a href={recipe.source_url} target="_blank" rel="noreferrer">
              View directions
            </a>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          className="mt-2 w-full text-xs"
          onClick={handleAddIngredients}
          disabled={!missingIngredients.length || added}
        >
          {added
            ? "Added to shopping list"
            : missingIngredients.length
            ? "Add ingredients to shopping list"
            : "Pantry already stocked"}
        </Button>
      </CardContent>
    </Card>
  );
}
