"use client";

import { useEffect, useId, useState } from "react";
import type { StorageCategory, StorageLocation } from "@/types";
import { STORAGE_CATEGORY_METADATA } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StorageManagerProps {
  storages: StorageLocation[];
  onCreate: (payload: { name: string; category: StorageCategory }) => Promise<StorageLocation>;
  onRename: (id: string, name: string) => Promise<StorageLocation>;
}

export function StorageManager({ storages, onCreate, onRename }: StorageManagerProps) {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; category: StorageCategory }>({ name: "", category: "dry" });
  const [editingName, setEditingName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<"add" | "rename">("add");
  const [renameId, setRenameId] = useState<string>("");

  const storageNameInputId = useId();
  const storageCategorySelectId = useId();
  const renameSelectId = useId();
  const renameNameInputId = useId();

  useEffect(() => {
    if (!renameId && storages.length) {
      const first = storages[0];
      setRenameId(first.id);
      setEditingName(first.name);
    }
  }, [renameId, storages]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setCreateError("Give your storage a name");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await onCreate({ name: form.name.trim(), category: form.category });
      setForm({ name: "", category: form.category });
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Unable to create storage");
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (storageId: string) => {
    if (!editingName.trim()) {
      setEditError("Name cannot be empty");
      return;
    }
    setEditError(null);
    try {
      await onRename(storageId, editingName.trim());
      setEditingName("");
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Unable to rename storage");
    }
  };

  return (
    <div className="flex justify-end">
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          className="h-10 w-10 rounded-full p-0 text-lg"
          onClick={() => {
            setMenuOpen((open) => !open);
            setMenuMode("add");
            setCreateError(null);
            setEditError(null);
          }}
          aria-label="Manage storage"
        >
          +
        </Button>

        {menuOpen ? (
          <div className="absolute right-0 top-12 z-20 w-80 space-y-3 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--background))] p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={menuMode === "add" ? "default" : "outline"}
                  onClick={() => {
                    setMenuMode("add");
                    setCreateError(null);
                  }}
                >
                  Add storage
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={menuMode === "rename" ? "default" : "outline"}
                  onClick={() => {
                    setMenuMode("rename");
                    setEditError(null);
                    setRenameId(storages[0]?.id ?? "");
                    setEditingName(storages.find((s) => s.id === renameId)?.name ?? "");
                  }}
                >
                  Edit names
                </Button>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setMenuOpen(false)}>
                Close
              </Button>
            </div>
            {menuMode === "add" ? (
              <form className="grid gap-3" onSubmit={handleCreate}>
                <div className="grid gap-2">
                  <Label htmlFor={storageNameInputId}>Storage name</Label>
                  <Input
                    id={storageNameInputId}
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Garage freezer"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={storageCategorySelectId}>Category</Label>
                  <select
                    id={storageCategorySelectId}
                    value={form.category}
                    onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as StorageCategory }))}
                    className="rounded-2xl border border-[rgb(var(--border))] bg-transparent px-3 py-2 text-sm"
                  >
                    {STORAGE_CATEGORY_METADATA.map((category) => (
                      <option key={category.key} value={category.key}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
                {createError ? <p className="text-sm text-rose-400">{createError}</p> : null}
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating…" : "Save"}
                </Button>
              </form>
            ) : (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor={renameSelectId}>Choose storage</Label>
                  <select
                    id={renameSelectId}
                    value={renameId}
                    onChange={(event) => {
                      const next = event.target.value;
                      setRenameId(next);
                      setEditingName(storages.find((storage) => storage.id === next)?.name ?? "");
                    }}
                    className="rounded-2xl border border-[rgb(var(--border))] bg-transparent px-3 py-2 text-sm"
                  >
                    <option value="">Select one</option>
                    {storages.map((storage) => (
                      <option key={storage.id} value={storage.id}>
                        {storage.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={renameNameInputId}>New name</Label>
                  <Input
                    id={renameNameInputId}
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    placeholder="Enter new name"
                  />
                </div>
                {editError ? <p className="text-sm text-rose-400">{editError}</p> : null}
                <Button
                  type="button"
                  disabled={!renameId}
                  onClick={() => {
                    if (renameId) {
                      void handleRename(renameId);
                    }
                  }}
                >
                  Save name
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
