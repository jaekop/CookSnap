"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Item, StorageLocation } from "@/types";
import { RiskBadge } from "@/components/RiskBadge";
import { riskFor } from "@/lib/risk";
import { STORAGE_CATEGORY_METADATA } from "@/lib/storage";

const RISK_CLUSTERS: { key: string; label: string; levels: Item["risk_level"][] }[] = [
  { key: "safe", label: "Safe", levels: ["safe"] },
  { key: "use-now", label: "Use now", levels: ["caution", "use-now"] },
  { key: "risky", label: "Risky", levels: ["risky"] },
];

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function formatAddedAt(value: string | null) {
  if (!value) {
    return "Date unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Date unknown";
  }

  const formatted = dateFormatter.format(date);
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  const relative = days === 0 ? "today" : `${days}d ago`;
  return `Added ${formatted} · ${relative}`;
}

interface PantryClientProps {
  initialItems: Item[];
  storageLocations: StorageLocation[];
}

export function PantryClient({ initialItems, storageLocations }: PantryClientProps) {
  const [items, setItems] = useState(initialItems);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggingIds, setDraggingIds] = useState<string[] | null>(null);
  const [activeDropId, setActiveDropId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [denseMode, setDenseMode] = useState(false);
  const [expandedStorages, setExpandedStorages] = useState<Set<string>>(new Set());
  const [openStorages, setOpenStorages] = useState<Set<string>>(new Set(storageLocations.map((storage) => storage.id)));

  const storageById = useMemo(() => new Map(storageLocations.map((s) => [s.id, s])), [storageLocations]);

  useEffect(() => {
    setOpenStorages((prev) => {
      const next = new Set<string>();
      for (const storage of storageLocations) {
        if (prev.has(storage.id)) {
          next.add(storage.id);
        }
      }
      if (next.size === 0) {
        for (const storage of storageLocations) {
          next.add(storage.id);
        }
      }
      return next;
    });
  }, [storageLocations]);

  const buckets = useMemo(() => {
    const grouped = new Map<string, Item[]>();
    const unassigned: Item[] = [];
    for (const item of items) {
      const storageId = item.storage_location_id;
      if (storageId) {
        const current = grouped.get(storageId) ?? [];
        current.push(item);
        grouped.set(storageId, current);
      } else {
        unassigned.push(item);
      }
    }
    return { grouped, unassigned };
  }, [items]);

  const categorySections = useMemo(() => {
    return STORAGE_CATEGORY_METADATA.map((category) => ({
      ...category,
      storages: storageLocations
        .filter((storage) => storage.category === category.key)
        .map((storage) => ({
          ...storage,
          items: buckets.grouped.get(storage.id) ?? [],
        })),
    }));
  }, [buckets.grouped, storageLocations]);

  const toggleSelectionMode = () => {
    setSelectionMode((value) => {
      if (value) {
        setSelectedIds(new Set());
      }
      return !value;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const moveItems = async (targetStorageId: string, idsToMove: string[]) => {
    const target = storageById.get(targetStorageId);
    if (!target || !idsToMove.length) {
      return;
    }
    setSaving(true);
    setError(null);
    const previous = items;
    setItems((prev) =>
      prev.map((item) =>
        idsToMove.includes(item.id)
          ? { ...item, storage_location_id: target.id, storage: target.category }
          : item
      )
    );
    try {
      const response = await fetch("/api/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: idsToMove,
          updates: { storage: target.category, storage_location_id: target.id },
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Unable to move items");
      }
      setSelectedIds(new Set(selectionMode ? idsToMove : []));
    } catch (err) {
      setItems(previous);
      setError(err instanceof Error ? err.message : "Move failed");
    } finally {
      setSaving(false);
      setDraggingIds(null);
      setActiveDropId(null);
    }
  };

  const handleDragStart = (itemId: string) => {
    const ids = selectionMode && selectedIds.size ? Array.from(selectedIds) : [itemId];
    setDraggingIds(ids);
  };

  const dropToStorage = (storageId: string) => {
    if (!draggingIds?.length) {
      return;
    }
    void moveItems(storageId, draggingIds);
  };

  const renderItemCard = (item: Item, expanded: boolean) => {
    const selected = selectedIds.has(item.id);
    const commonProps = {
      draggable: true,
      onDragStart: () => handleDragStart(item.id),
      onDragEnd: () => setDraggingIds(null),
      className: `flex items-center gap-2 rounded-xl border border-[rgb(var(--border))]/40 bg-[rgb(var(--accent))]/10 ${
        denseMode ? "px-2 py-1 text-sm" : "px-3 py-2"
      } transition hover:border-[rgb(var(--border))] ${
        selected ? "ring-2 ring-[rgb(var(--primary))]/60" : ""
      }`,
    };

    const compactContent = (
      <>
        {selectionMode ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => toggleSelect(item.id)}
            className="h-4 w-4 rounded border-[rgb(var(--border))]"
            aria-label="Select item"
          />
        ) : null}
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{item.name}</p>
            <RiskBadge level={riskFor(item)} />
          </div>
          <p className="text-xs text-[rgb(var(--muted-foreground))]">
            {item.qty} {item.unit ?? ""} · {item.category ?? "Uncategorized"}
          </p>
        </div>
      </>
    );

    const imageUrl = item.upc_image_url ?? item.upc_metadata?.image ?? null;
    const detailedContent = (
      <>
        {selectionMode ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => toggleSelect(item.id)}
            className="h-4 w-4 rounded border-[rgb(var(--border))]"
            aria-label="Select item"
          />
        ) : null}
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={item.name}
            width={40}
            height={40}
            unoptimized
            className="h-10 w-10 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--border))] text-[10px] text-[rgb(var(--muted-foreground))]">
            UPC
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{item.name}</p>
              <p className="text-[11px] text-[rgb(var(--muted-foreground))]">{formatAddedAt(item.added_at)}</p>
            </div>
            <RiskBadge level={riskFor(item)} />
          </div>
          <p className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">
            {item.qty} {item.unit ?? ""} · {item.category ?? "Uncategorized"}
          </p>
        </div>
      </>
    );

    const content = expanded ? detailedContent : compactContent;

    if (selectionMode) {
      return (
        <button
          key={item.id}
          {...commonProps}
          type="button"
          tabIndex={0}
          onClick={() => toggleSelect(item.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggleSelect(item.id);
            }
          }}
        >
          {content}
        </button>
      );
    }

    return (
      <Link key={item.id} href={`/pantry/${item.id}`} {...commonProps}>
        {content}
      </Link>
    );
  };

  const gridColumnsClass = denseMode ? "grid gap-3 md:grid-cols-2" : "grid gap-4 md:grid-cols-3";
  const storageCardPadding = denseMode ? "p-3" : "p-4";
  const storageSpacing = denseMode ? "space-y-3" : "space-y-4";

  const storagesContent = (
    <div className={denseMode ? "space-y-8" : "space-y-10"}>
      {categorySections.map((section) => (
        <section key={section.key} className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold">{section.label}</h2>
            <span className="text-xs uppercase tracking-wide text-[rgb(var(--muted-foreground))]">
              {section.storages.length} storage(s)
            </span>
          </div>
          {section.storages.length ? (
            <div className="space-y-4">
              {section.storages.map((storage) => (
                <button
                  key={storage.id}
                  className={`${storageSpacing} rounded-3xl border border-[rgb(var(--border))]/50 ${storageCardPadding} shadow-sm ${
                    activeDropId === storage.id ? "bg-[rgb(var(--accent))]/20" : "bg-[rgb(var(--card))]"
                  }`}
                  type="button"
                  tabIndex={0}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setActiveDropId(storage.id);
                  }}
                  onDragLeave={() => setActiveDropId(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    dropToStorage(storage.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      dropToStorage(storage.id);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{storage.name}</p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenStorages((prev) => {
                            const next = new Set(prev);
                            if (next.has(storage.id)) {
                              next.delete(storage.id);
                            } else {
                              next.add(storage.id);
                            }
                            return next;
                          });
                        }}
                      >
                        {openStorages.has(storage.id) ? "Collapse" : "Expand"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedStorages((prev) => {
                            const next = new Set(prev);
                            if (next.has(storage.id)) {
                              next.delete(storage.id);
                            } else {
                              next.add(storage.id);
                            }
                            return next;
                          });
                        }}
                      >
                        {expandedStorages.has(storage.id) ? "Hide details" : "Show details"}
                      </Button>
                      <span className="text-xs text-[rgb(var(--muted-foreground))]">{storage.items.length} item(s)</span>
                    </div>
                  </div>
                  {openStorages.has(storage.id) ? (
                    <div className={gridColumnsClass}>
                      {RISK_CLUSTERS.map((cluster) => {
                        const clusterItems = storage.items.filter((item) => cluster.levels.includes(riskFor(item)));

                        return (
                          <div
                            key={cluster.key}
                            className="rounded-2xl border border-[rgb(var(--border))]/50 bg-[rgb(var(--accent))]/10 p-3"
                          >
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold">{cluster.label}</h3>
                              <span className="text-xs text-[rgb(var(--muted-foreground))]">{clusterItems.length}</span>
                            </div>
                            <div className="mt-2 space-y-2">
                              {clusterItems.length ? (
                                clusterItems.map((item) => renderItemCard(item, expandedStorages.has(storage.id)))
                              ) : (
                                <p className="text-[11px] text-[rgb(var(--muted-foreground))]">No items here.</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[rgb(var(--muted-foreground))]">Collapsed</p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[rgb(var(--muted-foreground))]">No storages yet.</p>
          )}
        </section>
      ))}
    </div>
  );

  const unassignedContent = buckets.unassigned.length ? (
    <section className="space-y-3 rounded-3xl border border-[rgb(var(--border))]/60 bg-[rgb(var(--accent))]/10 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Unassigned items</h2>
        <span className="text-xs text-[rgb(var(--muted-foreground))]">{buckets.unassigned.length}</span>
      </div>
      <div className="space-y-2">
              {buckets.unassigned.map((item) => renderItemCard(item, true))}
      </div>
    </section>
  ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSelectionMode}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              selectionMode ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))]" : "border-[rgb(var(--border))]"
            }`}
          >
            {selectionMode ? "Exit multi-select" : "Multi-select"}
          </button>
          <button
            type="button"
            onClick={() => setDenseMode((value) => !value)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              denseMode ? "border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/10 text-[rgb(var(--primary))]" : "border-[rgb(var(--border))]"
            }`}
          >
            {denseMode ? "Comfort mode" : "Dense mode"}
          </button>
          {selectionMode ? (
            <span className="text-xs text-[rgb(var(--muted-foreground))]">{selectedIds.size} selected</span>
          ) : null}
        </div>
        {saving ? <span className="text-xs text-[rgb(var(--muted-foreground))]">Saving…</span> : null}
        {error ? <span className="text-xs text-rose-400">{error}</span> : null}
      </div>

      {unassignedContent ? (
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          {storagesContent}
          {unassignedContent}
        </div>
      ) : (
        storagesContent
      )}
    </div>
  );
}
