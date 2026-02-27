"use client";

const stages = [
  { key: "ALL", label: "All" },
  { key: "EARLY", label: "Early" },
  { key: "FORMING", label: "Forming" },
  { key: "CONFIRMED", label: "Confirmed" },
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
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
      {stages.map((stage) => (
        <button
          key={stage.key}
          onClick={() => onSelect(stage.key)}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
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
