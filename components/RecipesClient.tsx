"use client";

import { useMemo, useState, useEffect } from "react";
import type { Item, Recipe } from "@/types";
import { RecipeCard } from "@/components/RecipeCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const LOADING_MESSAGES = [
  "Loading the all the tastiness...",
  "Cook. Snap. Yum.",
  "For any support, email cooksnapsoftware@gmail.com",
  "Whisking up pantry-powered matches...",
  "Simmering through our recipe cloud...",
  "Seasoning results with a pinch of patience...",
];

interface RecipesClientProps {
  items: Item[];
  featured: Recipe[];
  pantryMatches: Recipe[];
  useNow: Recipe[];
  fallbackRecipes: Recipe[];
  datasetAvailable: boolean;
}

export function RecipesClient({ items, featured, pantryMatches, useNow, fallbackRecipes, datasetAvailable }: RecipesClientProps) {
  const [query, setQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchTerm("");
      return;
    }
    const timeout = window.setTimeout(() => setSearchTerm(trimmed), 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const trimmed = searchTerm.trim();
    let isCurrent = true;

    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setError(null);
      return () => controller.abort();
    }

    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      setResults([]);
      try {
        const response = await fetch(`/api/recipes/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const body = (await response.json()) as { data?: Recipe[] };
        if (isCurrent) {
          setResults(body.data ?? []);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError" && isCurrent) {
          setError("Search failed. Try again.");
        }
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    };

    fetchResults();
    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [searchTerm]);

  useEffect(() => {
    if (!loading) {
      setLoadingMessageIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2400);

    return () => window.clearInterval(interval);
  }, [loading]);

  const showSearchResults = Boolean(query.trim());
  const loadingMessage = LOADING_MESSAGES[loadingMessageIndex];

  const unavailableNotice = useMemo(() => {
    if (datasetAvailable) return null;
    if (fallbackRecipes.length) {
      return "Using bundled in-repo recipes. Add data/open-recipes/full_dataset.csv for a larger set.";
    }
    return "Add data/open-recipes/full_dataset.csv to unlock the full recipe dataset.";
  }, [datasetAvailable, fallbackRecipes.length]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          placeholder="Search for recipes or ingredients"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="flex-1"
        />
        {query ? (
          <Button variant="ghost" onClick={() => setQuery("")}>Clear</Button>
        ) : null}
      </div>

      {unavailableNotice ? <p className="text-xs text-[rgb(var(--muted-foreground))]">{unavailableNotice}</p> : null}

      {showSearchResults ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Search results</p>
            {loading ? <span className="text-xs text-[rgb(var(--muted-foreground))]">Searching…</span> : null}
          </div>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          <div className="grid gap-4 md:grid-cols-2">
            {results.length ? (
              results.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} pantryItems={items} />)
            ) : loading ? (
              <LoadingState message={loadingMessage} />
            ) : (
              <p className="col-span-2 text-sm text-[rgb(var(--muted-foreground))]">No recipes matched that search.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          <RecipeSection title="Ready now" subtitle="Highest pantry match" recipes={pantryMatches} fallback="No close matches yet." items={items} />
          <RecipeSection title="Use-it-now saver" subtitle="Uses risky ingredients" recipes={useNow} fallback="Nothing urgent. Keep cooking!" items={items} />
          <RecipeSection title="Chef's inspiration" subtitle="Random picks" recipes={featured} fallback="Add recipes to get inspired." items={items} />
        </div>
      )}
    </div>
  );
}

interface RecipeSectionProps {
  title: string;
  subtitle: string;
  recipes: Recipe[];
  fallback: string;
  items: Item[];
}

function RecipeSection({ title, subtitle, recipes, fallback, items }: RecipeSectionProps) {
  if (!recipes.length) {
    return (
      <section className="space-y-2">
        <header>
          <p className="text-xs uppercase tracking-wide text-[rgb(var(--muted-foreground))]">{title}</p>
          <p className="text-sm text-[rgb(var(--muted-foreground))]">{fallback}</p>
        </header>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header>
        <p className="text-xs uppercase tracking-wide text-[rgb(var(--muted-foreground))]">{title}</p>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">{subtitle}</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} pantryItems={items} />
        ))}
      </div>
    </section>
  );
}

interface LoadingStateProps {
  message: string;
}

function LoadingState({ message }: LoadingStateProps) {
  return (
    <div className="col-span-2 flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-[rgb(var(--muted-foreground))] bg-[rgba(255,255,255,0.03)] p-6 text-center">
      <p className="text-base font-semibold text-[rgb(var(--foreground))]">Searching for delicious matches</p>
      <p className="mt-2 text-xs uppercase tracking-wide text-[rgb(var(--muted-foreground))]">{message}</p>
    </div>
  );
}
