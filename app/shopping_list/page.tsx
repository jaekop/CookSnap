import { ShoppingListClient } from "@/components/ShoppingListClient";

export default function ShoppingListPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Shopping list</h1>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          Pull ingredients from any recipe card, then keep tabs on every errand or grocery run here.
        </p>
      </header>
      <ShoppingListClient />
    </div>
  );
}
