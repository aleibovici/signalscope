"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  type ReactNode,
} from "react";

export type SelectOption<V extends string = string> = {
  value: V;
  label: string;
  sub?: string;
  disabled?: boolean;
};

type SelectProps<V extends string> = {
  value: V;
  onChange: (next: V) => void;
  options: SelectOption<V>[];
  placeholder?: string;
  label?: string;
  ariaLabel?: string;
  renderValue?: (option: SelectOption<V> | undefined) => ReactNode;
  className?: string;
};

/**
 * Styled select primitive — replaces native <select> so it renders consistently
 * across OSes and in dark mode. Keyboard accessible (ArrowUp/Down/Enter/Esc),
 * closes on outside click, and does not scroll-lock the page.
 */
export function Select<V extends string = string>({
  value,
  onChange,
  options,
  placeholder,
  label,
  ariaLabel,
  renderValue,
  className = "",
}: SelectProps<V>) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const labelId = useId();

  const current = options.find((o) => o.value === value);

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
  }, []);

  // Outside click
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  // Reset highlight when opening
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHighlight(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(options.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[highlight];
      if (opt && !opt.disabled) {
        onChange(opt.value);
        close();
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlight(options.length - 1);
    }
  };

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      {label && (
        <label
          id={labelId}
          className="mb-1.5 block type-caption font-medium text-label"
        >
          {label}
        </label>
      )}
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-labelledby={label ? labelId : undefined}
        aria-label={!label ? ariaLabel : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border-input bg-surface-input px-3 type-body text-primary shadow-sm transition-colors hover:border-border-strong focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-400/40"
      >
        <span className="truncate text-left">
          {renderValue
            ? renderValue(current)
            : current?.label ?? <span className="text-muted">{placeholder ?? "Select…"}</span>}
        </span>
        <svg
          aria-hidden
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-fast ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={
            highlight >= 0 ? `${listboxId}-opt-${highlight}` : undefined
          }
          className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-border-default bg-surface-overlay py-1 shadow-overlay"
        >
          {options.map((opt, i) => {
            const selected = opt.value === value;
            const active = i === highlight;
            return (
              <li
                key={opt.value}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={selected}
                aria-disabled={opt.disabled || undefined}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value);
                  close();
                }}
                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 type-body transition-colors ${
                  opt.disabled
                    ? "cursor-not-allowed text-muted"
                    : active
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      : "text-primary"
                }`}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{opt.label}</span>
                  {opt.sub && <span className="truncate type-caption text-muted">{opt.sub}</span>}
                </span>
                {selected && (
                  <svg
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
