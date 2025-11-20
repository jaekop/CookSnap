"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Item, StorageLocation } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STORAGE_CATEGORY_METADATA, normalizeStorageCategory } from "@/lib/storage";

interface PantryItemEditorProps {
  item: Item;
  storages: StorageLocation[];
}

export function PantryItemEditor({ item, storages }: PantryItemEditorProps) {
  const router = useRouter();
  const normalizedCategory = normalizeStorageCategory(item.storage);
  const inferredStorageId =
    item.storage_location_id ??
    (normalizedCategory ? storages.find((storage) => storage.category === normalizedCategory)?.id : undefined) ??
    "";

  const [form, setForm] = useState({
    name: item.name,
    qty: item.qty.toString(),
    unit: item.unit ?? "",
    category: item.category ?? "",
    storageId: inferredStorageId,
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
            storage: selectedStorage?.category ?? null,
            storage_location_id: form.storageId || null,
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

  const nameId = useId();
  const qtyId = useId();
  const unitId = useId();
  const categoryId = useId();
  const storageId = useId();
  const selectedStorage = useMemo(() => storages.find((storage) => storage.id === form.storageId) ?? null, [form.storageId, storages]);
  const groupedStorages = useMemo(() => {
    return STORAGE_CATEGORY_METADATA.map((category) => ({
      ...category,
      locations: storages.filter((storage) => storage.category === category.key),
    }));
  }, [storages]);

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
        <Label htmlFor={nameId}>Name</Label>
        <Input id={nameId} value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={qtyId}>Quantity</Label>
          <Input id={qtyId} type="number" min="0" step="0.1" value={form.qty} onChange={(event) => updateField("qty", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={unitId}>Unit</Label>
          <Input id={unitId} value={form.unit} onChange={(event) => updateField("unit", event.target.value)} placeholder="pack, ct, g" />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={categoryId}>Category</Label>
        <Input id={categoryId} value={form.category} onChange={(event) => updateField("category", event.target.value)} placeholder="Pantry, Produce" />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={storageId}>Storage</Label>
        <select
          id={storageId}
          value={form.storageId}
          onChange={(event) => updateField("storageId", event.target.value)}
          className="rounded-2xl border border-[rgb(var(--border))] bg-transparent px-3 py-2 text-sm"
        >
          <option value="">Unassigned</option>
          {groupedStorages.map((group) => (
            <optgroup key={group.key} label={group.label}>
              {group.locations.map((storage) => (
                <option key={storage.id} value={storage.id}>
                  {storage.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {!storages.length ? <p className="text-xs text-amber-400">Create storage locations from the pantry page to speed up assignments.</p> : null}
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
