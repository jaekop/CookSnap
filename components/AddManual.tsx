"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { track } from "@/lib/analytics";
import type { StorageCategory, StorageLocation } from "@/types";
import { STORAGE_CATEGORY_METADATA } from "@/lib/storage";
import { useStorageLocations } from "@/hooks/useStorageLocations";

interface AddManualProps {
  onAdded?: () => Promise<void> | void;
  initialStorages: StorageLocation[];
}

export function AddManual({ onAdded, initialStorages }: AddManualProps) {
  const { storages, createStorage } = useStorageLocations(initialStorages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingStorage, setAddingStorage] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageForm, setStorageForm] = useState<{ name: string; category: StorageCategory }>({ name: "", category: "dry" });
  const [form, setForm] = useState({
    name: "",
    qty: "1",
    unit: "",
    category: "",
    storageId: initialStorages[0]?.id ?? "",
  });

  const handleChange = <Key extends keyof typeof form>(key: Key, value: (typeof form)[Key]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (!form.storageId && storages.length) {
      setForm((prev) => ({ ...prev, storageId: storages[0].id }));
    }
  }, [form.storageId, storages]);

  const groupedStorages = useMemo(() => {
    return STORAGE_CATEGORY_METADATA.map((category) => ({
      ...category,
      locations: storages.filter((storage) => storage.category === category.key),
    }));
  }, [storages]);

  const selectedStorage = storages.find((storage) => storage.id === form.storageId) ?? null;

  const handleCreateStorage = async () => {
    if (!storageForm.name.trim()) {
      setStorageError("Name your storage");
      return;
    }
    setAddingStorage(true);
    setStorageError(null);
    try {
      const created = await createStorage({ name: storageForm.name.trim(), category: storageForm.category });
      setStorageForm((prev) => ({ ...prev, name: "" }));
      setForm((prev) => ({ ...prev, storageId: created.id }));
    } catch (creationError) {
      setStorageError(creationError instanceof Error ? creationError.message : "Unable to create storage");
    } finally {
      setAddingStorage(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: form.name,
        qty: Number(form.qty) || 1,
        unit: form.unit || null,
        category: form.category || null,
        storage: selectedStorage?.category ?? null,
        storage_location_id: form.storageId || null,
      };

      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Unable to save item");
      }

      await track("add_item", { method: "manual", name: payload.name });
      setForm({ name: "", qty: "1", unit: "", category: "", storageId: storages[0]?.id ?? "" });
      await onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const nameId = useId();
  const qtyId = useId();
  const unitId = useId();
  const categoryId = useId();
  const storageSelectId = useId();
  const storageCreateNameId = useId();
  const storageCreateCategoryId = useId();

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor={nameId}>Item name</Label>
        <Input id={nameId} required value={form.name} onChange={(event) => handleChange("name", event.target.value)} placeholder="Shelf-stable almond milk" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={qtyId}>Quantity</Label>
          <Input id={qtyId} type="number" min="0" step="0.1" value={form.qty} onChange={(event) => handleChange("qty", event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={unitId}>Unit</Label>
          <Input id={unitId} value={form.unit} onChange={(event) => handleChange("unit", event.target.value)} placeholder="bottle, ct, g" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={categoryId}>Category</Label>
        <Input id={categoryId} value={form.category} onChange={(event) => handleChange("category", event.target.value)} placeholder="Pantry, Produce, Dairy" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={storageSelectId}>Storage</Label>
        <select
          id={storageSelectId}
          value={form.storageId}
          onChange={(event) => handleChange("storageId", event.target.value)}
          className="rounded-2xl border border-[rgb(var(--border))] bg-transparent px-3 py-2 text-sm"
        >
          <option value="">Select a storage</option>
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
        {!storages.length ? <p className="text-xs text-amber-400">Create a storage location below to start organizing items.</p> : null}
      </div>
      <div className="rounded-2xl border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--accent))]/10 p-3">
        <details>
          <summary className="cursor-pointer text-sm font-medium">Need another storage?</summary>
          <div className="mt-3 grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor={storageCreateNameId}>Name</Label>
              <Input
                id={storageCreateNameId}
                value={storageForm.name}
                onChange={(event) => setStorageForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Garage freezer"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={storageCreateCategoryId}>Category</Label>
              <select
                id={storageCreateCategoryId}
                value={storageForm.category}
                onChange={(event) => setStorageForm((prev) => ({ ...prev, category: event.target.value as StorageCategory }))}
                className="rounded-2xl border border-[rgb(var(--border))] bg-transparent px-3 py-2 text-sm"
              >
                {STORAGE_CATEGORY_METADATA.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
            {storageError ? <p className="text-sm text-rose-400">{storageError}</p> : null}
            <Button type="button" disabled={addingStorage} onClick={() => void handleCreateStorage()}>
              {addingStorage ? "Saving…" : "Add storage"}
            </Button>
          </div>
        </details>
      </div>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      <Button disabled={loading} type="submit" className="h-12">
        {loading ? "Adding…" : "Add item"}
      </Button>
    </form>
  );
}
