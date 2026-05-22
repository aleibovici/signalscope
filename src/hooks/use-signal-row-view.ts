"use client";

import { useState, useCallback } from "react";
import {
  defaultSortDir,
  loadRowSort,
  saveRowSort,
  type SignalRowSortDir,
  type SignalRowSortKey,
} from "@/lib/signal-row-sort";

type UseSignalRowViewOptions = {
  viewModeKey: string;
  /** When set, enables client-side column sort persisted to this key. */
  sortStorageKey?: string;
};

function readViewMode(viewModeKey: string): "card" | "row" {
  try {
    const saved = localStorage.getItem(viewModeKey);
    if (saved === "row" || saved === "card") return saved;
  } catch {
    /* ignore */
  }
  return "card";
}

export function useSignalRowView({ viewModeKey, sortStorageKey }: UseSignalRowViewOptions) {
  const [viewMode, setViewMode] = useState<"card" | "row">(() => readViewMode(viewModeKey));
  const [sortKey, setSortKey] = useState<SignalRowSortKey | null>(() =>
    sortStorageKey ? loadRowSort(sortStorageKey).key : null,
  );
  const [sortDir, setSortDir] = useState<SignalRowSortDir>(() =>
    sortStorageKey ? loadRowSort(sortStorageKey).dir : "desc",
  );

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next = prev === "card" ? "row" : "card";
      try {
        localStorage.setItem(viewModeKey, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [viewModeKey]);

  const handleSort = useCallback(
    (key: SignalRowSortKey) => {
      if (!sortStorageKey) return;
      if (sortKey === key) {
        const next = sortDir === "desc" ? "asc" : "desc";
        setSortDir(next);
        saveRowSort(sortStorageKey, key, next);
        return;
      }
      const nextDir = defaultSortDir(key);
      setSortKey(key);
      setSortDir(nextDir);
      saveRowSort(sortStorageKey, key, nextDir);
    },
    [sortKey, sortDir, sortStorageKey],
  );

  return { viewMode, toggleViewMode, sortKey, sortDir, handleSort };
}
