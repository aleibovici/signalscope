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
      <div className="flex overflow-x-auto border-b border-gray-200 dark:border-zinc-800 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stages.map((stage) => {
          const isActive = selected === stage.key;
          return (
            <button
              key={stage.key}
              onClick={() => onSelect(stage.key)}
              className={`relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none ${
                isActive
                  ? "text-[#afc6ff] dark:text-[#afc6ff]"
                  : "text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-[#c2c6d7]"
              }`}
            >
              {stage.label}
              {counts && counts[stage.key] !== undefined && (
                <span
                  className={`ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${
                    isActive
                      ? "bg-blue-100 text-blue-700 dark:bg-[#afc6ff]/15 dark:text-[#afc6ff]"
                      : "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-500"
                  }`}
                >
                  {counts[stage.key]}
                </span>
              )}
              {/* Active underline */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 h-[2px] w-full rounded-t-sm"
                  style={{ background: "#afc6ff" }}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
      {/* Scroll affordance — mobile only */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-white dark:from-zinc-950 sm:hidden" />
    </div>
  );
}
