"use client";

import { STAGE_LABELS } from "@/lib/stage-labels";

const stages = [
  { key: "ALL", label: "All" },
  { key: STAGE_LABELS.EARLY, label: STAGE_LABELS.EARLY },
  { key: STAGE_LABELS.FORMING, label: STAGE_LABELS.FORMING },
  { key: STAGE_LABELS.CONFIRMED, label: STAGE_LABELS.CONFIRMED },
];

export function StageTabs({
  selected,
  onSelect,
  counts,
}: {
  selected: string;
  onSelect: (stage: string) => void;
  counts?: Record<string, number>;
}) {
  return (
    <div className="relative">
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-zinc-900/80 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {stages.map((stage) => (
        <button
          key={stage.key}
          onClick={() => onSelect(stage.key)}
          className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:py-2 sm:text-sm ${
            selected === stage.key
              ? "bg-white text-gray-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100 dark:shadow-none dark:ring-1 dark:ring-blue-500/30"
              : "text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          {stage.label}
          {counts && counts[stage.key] !== undefined && (
            <span className={`ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
              selected === stage.key
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                : "bg-gray-200 text-gray-500 dark:bg-zinc-700 dark:text-zinc-400"
            }`}>
              {counts[stage.key]}
            </span>
          )}
        </button>
      ))}
      </div>
      {/* Scroll affordance — fade gradient visible only when content overflows (mobile) */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-lg bg-linear-to-l from-gray-100 dark:from-zinc-900/80 sm:hidden" />
    </div>
  );
}
