import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecipeCard } from "@/components/RecipeCard";
import { RiskBadge } from "@/components/RiskBadge";
import recipes from "@/data/recipes.json";
import { getUseItNow } from "@/lib/recommend";
import { createSupabaseServerClient, requireUserId } from "@/lib/supabase";
import { riskFor } from "@/lib/risk";
import { getStorageCategoryLabel, normalizeStorageCategory } from "@/lib/storage";
import type { Item, Recipe } from "@/types";

type DashboardData = {
  items: Item[];
  events: Array<{ id: string; type: string; payload: unknown; created_at: string }>;
  recommended: Recipe[];
  summary: { totalItems: number; risky: number; lastEvent: string | null };
};

type DashboardResult = DashboardData | { error: string };

async function getDashboard(): Promise<DashboardResult> {
  const supabase = await createSupabaseServerClient();

  try {
    const userId = await requireUserId(supabase);

    const membershipPromise = supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .maybeSingle();

    const eventsPromise = supabase
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6);

    const [{ data: membership }, { data: events = [] }] = await Promise.all([membershipPromise, eventsPromise]);

    const householdId = membership?.household_id ?? null;
    let typedItems: Item[] = [];

    if (householdId) {
      const { data: items = [] } = await supabase
        .from("items")
        .select("*, storage_location:storage_locations(*)")
        .eq("household_id", householdId)
        .order("added_at", { ascending: false });
      typedItems = items as Item[];
    }

    const recommended = getUseItNow(typedItems, recipes as Recipe[]);

    const summary = {
      totalItems: typedItems.length,
      risky: typedItems.filter((item) => ["use-now", "risky"].includes(riskFor(item))).length,
      lastEvent: events.at(0)?.created_at ?? null,
    };

    return { items: typedItems, events, recommended, summary };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

function SignInCTA() {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--accent))]/20 p-8 text-center">
      <h2 className="text-2xl font-semibold">CookSnap keeps your fridge honest.</h2>
      <p className="mt-2 text-[rgb(var(--muted-foreground))]">
        Sign in with Supabase Auth (magic link works great) to sync your household pantry and activity log.
      </p>
      <Link href="/login" className="mt-6 inline-flex">
        <Button size="lg">Launch sign-in</Button>
      </Link>
    </div>
  );
}

function ActivityList({ events }: { events: Array<{ id: string; type: string; payload: unknown; created_at: string }> }) {
  if (!events.length) {
    return <p className="text-sm text-[rgb(var(--muted-foreground))]">No activity yet — add something to kick off tracking.</p>;
  }

  return (
    <ul className="space-y-2 text-sm">
      {events.map((event) => (
        <li key={event.id} className="flex items-baseline justify-between rounded-2xl bg-[rgb(var(--accent))]/20 px-4 py-3">
          <span className="capitalize">{event.type.replace(/_/g, " ")}</span>
          <time className="text-[rgb(var(--muted-foreground))]">{new Date(event.created_at).toLocaleString()}</time>
        </li>
      ))}
    </ul>
  );
}

export default async function HomePage() {
  const data = await getDashboard();

  if ("error" in data) {
    return <SignInCTA />;
  }

  const { items, events, recommended, summary } = data;

  return (
    <section className="space-y-8">
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{summary.totalItems}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{summary.risky}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Last activity</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold">
            {summary.lastEvent ? new Date(summary.lastEvent).toLocaleString() : "—"}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Use-it-now recipes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {recommended.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} pantryItems={items} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latest events</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityList events={events} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recently added</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.slice(0, 6).map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-2xl border border-[rgb(var(--border))]/60 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-[rgb(var(--muted-foreground))]">
                  {item.qty} {item.unit ?? ""} ·{" "}
                  {item.storage_location?.name ?? getStorageCategoryLabel(normalizeStorageCategory(item.storage))}
                </p>
              </div>
              <RiskBadge level={riskFor(item)} />
            </div>
          ))}
          {!items.length ? <p className="text-sm text-[rgb(var(--muted-foreground))]">Add your first item to see it here.</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}
