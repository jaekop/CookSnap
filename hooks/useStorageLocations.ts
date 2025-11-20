"use client";

import { useCallback, useState } from "react";
import type { StorageCategory, StorageLocation } from "@/types";

interface CreateStoragePayload {
  name: string;
  category: StorageCategory;
}

interface UpdateStoragePayload {
  id: string;
  name?: string;
  category?: StorageCategory;
}

export function useStorageLocations(initial: StorageLocation[]) {
  const [storages, setStorages] = useState<StorageLocation[]>(initial);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/storage", { method: "GET" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to load storage locations");
    }
    setStorages(payload.data ?? []);
    return payload.data as StorageLocation[];
  }, []);

  const createStorage = useCallback(async ({ name, category }: CreateStoragePayload) => {
    const response = await fetch("/api/storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to create storage");
    }
    setStorages((prev) => [...prev, payload.data as StorageLocation]);
    return payload.data as StorageLocation;
  }, []);

  const updateStorage = useCallback(async ({ id, name, category }: UpdateStoragePayload) => {
    const response = await fetch("/api/storage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, category }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to update storage");
    }
    setStorages((prev) => prev.map((storage) => (storage.id === id ? (payload.data as StorageLocation) : storage)));
    return payload.data as StorageLocation;
  }, []);

  const deleteStorage = useCallback(async (id: string) => {
    const response = await fetch("/api/storage", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to delete storage");
    }
    setStorages((prev) => prev.filter((storage) => storage.id !== id));
    return true;
  }, []);

  return { storages, setStorages, refresh, createStorage, updateStorage, deleteStorage };
}
