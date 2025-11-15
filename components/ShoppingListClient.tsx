"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  readManualEntries,
  writeManualEntries,
  SHOPPING_LIST_UPDATED_EVENT,
  type ShoppingListManualEntry,
} from "@/lib/shopping-list";
import { cn } from "@/lib/utils";

export function ShoppingListClient() {
  const [manualItems, setManualItems] = useState<ShoppingListManualEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [formValues, setFormValues] = useState({
    name: "",
    qty: "",
    unit: "",
    store: "",
    note: "",
  });
  const manualNameId = useId();
  const manualQtyId = useId();
  const manualUnitId = useId();
  const manualStoreId = useId();
  const manualNoteId = useId();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setManualItems(readManualEntries());
    setHydrated(true);

    const handleUpdate = () => {
      setManualItems(readManualEntries());
    };
    window.addEventListener(SHOPPING_LIST_UPDATED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(SHOPPING_LIST_UPDATED_EVENT, handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeManualEntries(manualItems);
  }, [manualItems, hydrated]);

  const handleManualSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = formValues.name.trim();
    if (!name) return;
    const entry: ShoppingListManualEntry = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`,
      name,
      qty: formValues.qty.trim() || undefined,
      unit: formValues.unit.trim() || undefined,
      store: formValues.store.trim() || undefined,
      note: formValues.note.trim() || undefined,
      done: false,
    };
    setManualItems((items) => [entry, ...items]);
    setFormValues({ name: "", qty: "", unit: "", store: "", note: "" });
  };

  const toggleManualItem = (id: string) => {
    setManualItems((items) => items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  const removeManualItem = (id: string) => {
    setManualItems((items) => items.filter((item) => item.id !== id));
  };

  const downloadList = () => {
    const lines: string[] = [];
    lines.push("CookSnap shopping list", "");
    const pendingManual = manualItems.filter((item) => !item.done);
    if (pendingManual.length) {
      lines.push("Pending reminders:");
      pendingManual.forEach((item) => {
        const qty = item.qty ? `${item.qty}${item.unit ? ` ${item.unit}` : ""}` : "";
        const meta = [qty, item.store, item.note, item.sourceRecipeTitle ? `Recipe: ${item.sourceRecipeTitle}` : null]
          .filter(Boolean)
          .join(" · ");
        lines.push(`- ${item.name}${meta ? ` (${meta})` : ""}`);
      });
      lines.push("");
    }
    if (!pendingManual.length) {
      lines.push("Nothing pending. 🎉");
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "CookSnap-shopping-list.txt";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const pendingCount = manualItems.filter((item) => !item.done).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[rgb(var(--muted-foreground))]">Shopping intel</p>
          <h2 className="text-2xl font-semibold">Build your grocery game plan</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={downloadList}>
            Download list (.txt)
          </Button>
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-4 rounded-3xl border border-[rgb(var(--border))]/60 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Shopping list</h3>
              <p className="text-sm text-[rgb(var(--muted-foreground))]">
                Ingredients you pull from recipes plus any manual errands you jot down.
              </p>
            </div>
            <span className="text-xs text-[rgb(var(--muted-foreground))]">{pendingCount} pending</span>
          </div>
          <div className="space-y-3">
            {manualItems.length === 0 ? (
              <p className="text-sm text-[rgb(var(--muted-foreground))]">
                Tap “Add ingredients to shopping list” on a recipe card or drop manual reminders using the form.
              </p>
            ) : (
              manualItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-2xl border border-[rgb(var(--border))]/50 px-4 py-3",
                    item.done ? "opacity-60 line-through" : ""
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{item.name}</p>
                      <p className="text-xs text-[rgb(var(--muted-foreground))]">
                        {[
                          item.qty ? `${item.qty}${item.unit ? ` ${item.unit}` : ""}` : null,
                          item.store ?? null,
                          item.note ?? null,
                          item.sourceRecipeTitle ? `Recipe: ${item.sourceRecipeTitle}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Just a reminder"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => toggleManualItem(item.id)}>
                        {item.done ? "Undo" : "Done"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeManualItem(item.id)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        <section className="space-y-4 rounded-3xl border border-[rgb(var(--border))]/60 p-6">
          <div>
            <h3 className="text-lg font-semibold">Manual add-ons</h3>
            <p className="text-sm text-[rgb(var(--muted-foreground))]">
              Need to remember staples, errands, or drop-offs? Park them here.
            </p>
          </div>
          <form className="space-y-3" onSubmit={handleManualSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor={manualNameId}>Item</Label>
              <Input
                id={manualNameId}
                placeholder="e.g., almond milk"
                value={formValues.name}
                onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={manualQtyId}>Qty</Label>
                <Input
                  id={manualQtyId}
                  placeholder="2"
                  className="sm:max-w-[160px]"
                  value={formValues.qty}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, qty: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={manualUnitId}>Unit</Label>
                <Input
                  id={manualUnitId}
                  placeholder="cartons"
                  className="sm:max-w-[160px]"
                  value={formValues.unit}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, unit: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={manualStoreId}>Store / aisle</Label>
              <Input
                id={manualStoreId}
                placeholder="Trader Joe's"
                value={formValues.store}
                onChange={(event) => setFormValues((prev) => ({ ...prev, store: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={manualNoteId}>Note</Label>
              <textarea
                id={manualNoteId}
                className="min-h-[70px] w-full rounded-xl border border-[rgb(var(--border))] bg-transparent px-3 py-2 text-sm text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--muted-foreground))]"
                placeholder="Anything special to remember?"
                value={formValues.note}
                onChange={(event) => setFormValues((prev) => ({ ...prev, note: event.target.value }))}
              />
            </div>
            <Button type="submit" className="w-full">
              Add reminder
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
