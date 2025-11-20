"use client";

import Link from "next/link";
import type { Item, StorageLocation } from "@/types";
import { PantryClient } from "@/components/PantryClient";
import { StorageManager } from "@/components/StorageManager";
import { useStorageLocations } from "@/hooks/useStorageLocations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PantryWorkspaceProps {
  initialItems: Item[];
  initialStorages: StorageLocation[];
}

export function PantryWorkspace({ initialItems, initialStorages }: PantryWorkspaceProps) {
  const { storages, createStorage, updateStorage } = useStorageLocations(initialStorages);

  return (
    <div className="space-y-6">
      <StorageManager storages={storages} onCreate={createStorage} onRename={(id, name) => updateStorage({ id, name })} />
      {initialItems.length ? (
        <PantryClient initialItems={initialItems} storageLocations={storages} />
      ) : (
        <Card className="mx-auto max-w-xl text-center">
          <CardHeader>
            <CardTitle>Your pantry is empty</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-[rgb(var(--muted-foreground))]">
            <p>Add items via barcode, receipt, or manual entry to start tracking freshness.</p>
            <Button asChild>
              <Link href="/add">Add your first item</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
