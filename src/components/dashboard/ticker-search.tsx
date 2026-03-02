"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

interface SearchResult {
  symbol: string;
  aiScore: number | null;
  stage: string | null;
  price: number | null;
}

const STAGE_COLORS: Record<string, string> = {
  CONFIRMED: "text-green-600",
  FORMING: "text-yellow-600",
  EARLY: "text-blue-600",
  FILTERED: "text-red-500",
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function TickerSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 250);

  const { data } = useQuery<{ results: SearchResult[] }>({
    queryKey: ["search", debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedQuery.length >= 1,
    staleTime: 30_000,
  });

  const results = useMemo(() => data?.results ?? [], [data]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const navigate = useCallback(
    (symbol: string) => {
      router.push(`/ticker/${symbol}`);
      setQuery("");
      setOpen(false);
    },
    [router]
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && open && results.length > 0) {
      e.preventDefault();
      navigate(results[highlighted].symbol);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={containerRef} className="relative px-3 pb-3 pt-1">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search ticker…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlighted(0);
          }}
          onFocus={() => query.length >= 1 && setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-3 right-3 top-full z-50 mt-0.5 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          {results.map((r, i) => (
            <button
              key={r.symbol}
              type="button"
              onMouseDown={() => navigate(r.symbol)}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                i === highlighted ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <span className="font-semibold tracking-wide">{r.symbol}</span>
              <div className="flex items-center gap-2 text-xs">
                {r.stage && (
                  <span className={`font-medium ${STAGE_COLORS[r.stage] ?? "text-gray-500"}`}>
                    {r.stage}
                  </span>
                )}
                {r.aiScore != null && (
                  <span className="text-gray-400">{r.aiScore}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && debouncedQuery.length >= 1 && results.length === 0 && (
        <div className="absolute left-3 right-3 top-full z-50 mt-0.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-400 shadow-lg">
          No tickers found
        </div>
      )}
    </div>
  );
}
