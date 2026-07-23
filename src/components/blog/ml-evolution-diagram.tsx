type Stage = {
  label: string;
  subLabel: string;
  ic: number;
  icLabel: string;
  featureNote: string;
  barColor: string;
  barColorDark: string;
};

const STAGES: Stage[] = [
  {
    label: "Ridge baseline",
    subLabel: "Mar — experiment 1",
    ic: 0.006,
    icLabel: "0.006",
    featureNote: "14 basic counts + aggregates",
    barColor: "#94a3b8",
    barColorDark: "#64748b",
  },
  {
    label: "+ atomic P&D flags",
    subLabel: "Mar 22 — experiment 14",
    ic: 0.077,
    icLabel: "0.077",
    featureNote: "+24 pump-and-dump flags",
    barColor: "#60a5fa",
    barColorDark: "#3b82f6",
  },
  {
    label: "+ historical features",
    subLabel: "Apr 4 — experiment 38",
    ic: 0.101,
    icLabel: "0.101",
    featureNote: "+ P&D history · interactions",
    barColor: "#3b82f6",
    barColorDark: "#2563eb",
  },
  {
    label: "Ridge + LGBM ensemble",
    subLabel: "Apr 13 — experiment 601",
    ic: 0.101,
    icLabel: "0.101",
    featureNote: "per-horizon blend · inverted 7d",
    barColor: "#2563eb",
    barColorDark: "#1d4ed8",
  },
  {
    label: "Pure LGBM",
    subLabel: "Apr 19 — experiment 609",
    ic: 0.161,
    icLabel: "0.161",
    featureNote: "293 features · 10 used · 3-day target",
    barColor: "#10b981",
    barColorDark: "#059669",
  },
];

export function MlEvolutionDiagram() {
  const width = 760;
  const height = 380;
  const chartTop = 40;
  const chartBottom = 220;
  const chartLeft = 60;
  const chartRight = 730;
  const icMax = 0.18;
  const barWidth = 64;

  const xFor = (i: number) => {
    const span = chartRight - chartLeft;
    return chartLeft + (span * (i + 0.5)) / STAGES.length;
  };
  const yFor = (ic: number) => {
    const h = chartBottom - chartTop;
    return chartBottom - (ic / icMax) * h;
  };

  const gridlines = [0, 0.05, 0.1, 0.15];

  // Position the regime-shift marker between the 4th and 5th bars
  const regimeShiftX = (xFor(3) + xFor(4)) / 2;

  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-gray-200 bg-white">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full h-auto"
        role="img"
        aria-labelledby="ml-evo-title ml-evo-desc"
      >
        <title id="ml-evo-title">
          Mean information coefficient at each model-architecture milestone, March–April 2026
        </title>
        <desc id="ml-evo-desc">
          Bar chart showing IC rising from 0.006 at the Ridge baseline to 0.161 at the pure
          LightGBM model, with a regime shift between the Ridge+LGBM ensemble and the final pure
          LGBM model.
        </desc>

        {/* Y-axis label */}
        <text
          x={18}
          y={chartTop - 18}
          fontSize={11}
          fontWeight={600}
          fill="#374151"
          letterSpacing="0.05em"
        >
          MEAN IC
        </text>

        {/* Gridlines */}
        {gridlines.map((g) => (
          <g key={g}>
            <line
              x1={chartLeft}
              x2={chartRight}
              y1={yFor(g)}
              y2={yFor(g)}
              stroke="#e5e7eb"
              strokeDasharray="2 3"
              strokeWidth={1}
            />
            <text
              x={chartLeft - 8}
              y={yFor(g) + 3}
              fontSize={10}
              fill="#9ca3af"
              textAnchor="end"
            >
              {g.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Baseline (IC = 0) */}
        <line
          x1={chartLeft}
          x2={chartRight}
          y1={chartBottom}
          y2={chartBottom}
          stroke="#d1d5db"
          strokeWidth={1}
        />

        {/* Regime-shift zigzag marker between bars 4 and 5 */}
        <g>
          <path
            d={`M ${regimeShiftX - 8} ${chartTop + 16}
                L ${regimeShiftX - 2} ${chartTop + 34}
                L ${regimeShiftX - 10} ${chartTop + 52}
                L ${regimeShiftX - 2} ${chartTop + 70}
                L ${regimeShiftX - 10} ${chartTop + 88}
                L ${regimeShiftX - 2} ${chartTop + 106}
                L ${regimeShiftX - 10} ${chartTop + 124}
                L ${regimeShiftX - 2} ${chartTop + 142}
                L ${regimeShiftX - 10} ${chartTop + 160}
                L ${regimeShiftX - 2} ${chartTop + 178}`}
            stroke="#f59e0b"
            strokeWidth={2}
            fill="none"
          />
          {/* Compact label above the zigzag — sits in the gap between bars, clear of all IC labels */}
          <text
            x={regimeShiftX - 6}
            y={chartTop + 6}
            fontSize={9}
            fontWeight={700}
            fill="#92400e"
            textAnchor="middle"
            letterSpacing="0.04em"
          >
            REGIME
          </text>
          <text
            x={regimeShiftX - 6}
            y={chartBottom - 4}
            fontSize={9}
            fontWeight={700}
            fill="#92400e"
            textAnchor="middle"
            letterSpacing="0.04em"
          >
            SHIFT
          </text>
        </g>

        {/* Bars + labels */}
        {STAGES.map((stage, i) => {
          const cx = xFor(i);
          const top = yFor(stage.ic);
          const barHeight = chartBottom - top;
          return (
            <g key={stage.label}>
              {/* bar */}
              <rect
                x={cx - barWidth / 2}
                y={top}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill={stage.barColor}
              />
              {/* IC label on top */}
              <text
                x={cx}
                y={top - 8}
                fontSize={13}
                fontWeight={700}
                fill="#111827"
                textAnchor="middle"
              >
                {stage.icLabel}
              </text>

              {/* Stage label below baseline */}
              <text
                x={cx}
                y={chartBottom + 22}
                fontSize={12}
                fontWeight={600}
                fill="#111827"
                textAnchor="middle"
              >
                {stage.label}
              </text>
              {/* Sub-label (date + exp number) */}
              <text
                x={cx}
                y={chartBottom + 38}
                fontSize={10}
                fill="#6b7280"
                textAnchor="middle"
              >
                {stage.subLabel}
              </text>
              {/* Feature note — wrap to 2 lines if needed */}
              <FeatureNote x={cx} y={chartBottom + 60} text={stage.featureNote} />
            </g>
          );
        })}

        {/* Connector arrows between bars */}
        {STAGES.slice(0, -1).map((_, i) => {
          const isRegimeGap = i === 3;
          const startX = xFor(i) + barWidth / 2 + 4;
          const endX = xFor(i + 1) - barWidth / 2 - 4;
          const y = chartBottom - 8;
          if (isRegimeGap) return null; // skip; regime marker takes this space
          return (
            <g key={`arrow-${i}`}>
              <line
                x1={startX}
                x2={endX}
                y1={y}
                y2={y}
                stroke="#9ca3af"
                strokeWidth={1.5}
                markerEnd="url(#arrowhead)"
              />
            </g>
          );
        })}

        <defs>
          <marker
            id="arrowhead"
            viewBox="0 0 10 10"
            refX={8}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#9ca3af" />
          </marker>
        </defs>
      </svg>
      <figcaption className="px-4 py-3 text-xs text-gray-500 border-t border-gray-100">
        Information coefficient (IC) is the rank correlation between the model&apos;s predicted ranking
        of tickers and their actual forward returns — higher is better, 0 is random. The biggest
        single gain came from how we represented the pump-and-dump flags, not from the model itself.
        At the regime shift, the previous best configuration dropped to IC −0.010 on new data,
        forcing the pipeline back to a simpler pure-LightGBM model.
      </figcaption>
    </figure>
  );
}

function FeatureNote({ x, y, text }: { x: number; y: number; text: string }) {
  // Split on " · " or comma to wrap; otherwise single line.
  const parts = text.includes(" · ")
    ? text.split(" · ")
    : text.length > 28
      ? splitOnce(text, ", ")
      : [text];
  return (
    <>
      {parts.map((line, i) => (
        <text
          key={i}
          x={x}
          y={y + i * 13}
          fontSize={10}
          fill="#4b5563"
          textAnchor="middle"
        >
          {line}
        </text>
      ))}
    </>
  );
}

function splitOnce(s: string, sep: string): string[] {
  const idx = s.indexOf(sep);
  if (idx === -1) return [s];
  return [s.slice(0, idx), s.slice(idx + sep.length)];
}
