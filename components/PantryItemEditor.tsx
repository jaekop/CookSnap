"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Item } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STORAGE_OPTIONS = [
  { label: "Pantry", value: "ambient" },
  { label: "Fridge", value: "fridge" },
  { label: "Freezer", value: "freezer" },
];

interface PantryItemEditorProps {
  item: Item;
}

export function PantryItemEditor({ item }: PantryItemEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: item.name,
    qty: item.qty.toString(),
    unit: item.unit ?? "",
    category: item.category ?? "",
    storage: item.storage ?? "ambient",
    opened: item.opened,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateField = <Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          updates: {
            name: form.name,
            qty: Number(form.qty) || 1,
            unit: form.unit || null,
            category: form.category || null,
            storage: form.storage,
            opened: form.opened,
          },
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Unable to update item");
      }

      setMessage("Item updated");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm("Remove this item from your pantry?");
    if (!confirmed) {
      return;
    }
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Unable to delete item");
      }

      router.replace("/pantry");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-6 shadow-sm">
      <div>
        <p className="text-xs uppercase tracking-wide text-[rgb(var(--muted-foreground))]">Item</p>
        <h1 className="text-2xl font-semibold">{item.name}</h1>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="item-name">Name</Label>
        <Input id="item-name" value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="item-qty">Quantity</Label>
          <Input id="item-qty" type="number" min="0" step="0.1" value={form.qty} onChange={(event) => updateField("qty", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="item-unit">Unit</Label>
          <Input id="item-unit" value={form.unit} onChange={(event) => updateField("unit", event.target.value)} placeholder="pack, ct, g" />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="item-category">Category</Label>
        <Input id="item-category" value={form.category} onChange={(event) => updateField("category", event.target.value)} placeholder="Pantry, Produce" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="item-storage">Storage</Label>
        <select
          id="item-storage"
          value={form.storage}
          onChange={(event) => updateField("storage", event.target.value)}
          className="rounded-2xl border border-[rgb(var(--border))] bg-transparent px-3 py-2 text-sm"
        >
          {STORAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value} className="bg-[rgb(var(--background))] text-[rgb(var(--foreground))]">
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.opened}
          onChange={(event) => updateField("opened", event.target.checked)}
          className="h-4 w-4 rounded border-[rgb(var(--border))]"
        />
        Mark as opened
      </label>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" onClick={handleDelete} disabled={deleting}>
          {deleting ? "Removing…" : "Delete"}
        </Button>
      </div>
    </form>
  );
}
