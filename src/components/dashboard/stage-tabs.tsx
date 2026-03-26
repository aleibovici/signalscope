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
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stages.map((stage) => (
          <button
            key={stage.key}
            onClick={() => onSelect(stage.key)}
            aria-pressed={selected === stage.key}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors sm:px-5 sm:py-2 ${
              selected === stage.key
                ? "bg-blue-500 text-white dark:bg-blue-500 dark:text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {stage.label}
            {counts && counts[stage.key] !== undefined && (
              <span className={`ml-2 tabular-nums font-medium ${
                selected === stage.key
                  ? "text-blue-100"
                  : "text-gray-400 dark:text-zinc-500"
              }`}>
                {counts[stage.key]}
              </span>
            )}
          </button>
        ))}
      </div>
      {/* Scroll affordance — mobile only */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-gray-50 dark:from-[#0a0d12] sm:hidden" />
    </div>
  );
}
