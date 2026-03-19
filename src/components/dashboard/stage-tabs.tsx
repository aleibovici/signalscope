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
    <div className="flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1">
      {stages.map((stage) => (
        <button
          key={stage.key}
          onClick={() => onSelect(stage.key)}
          className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            selected === stage.key
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {stage.label}
          {counts && counts[stage.key] !== undefined && (
            <span className="ml-1.5 text-xs text-gray-400">
              {counts[stage.key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
