import type { CSSProperties } from "react";

const COLS_NO_STAGE =
  "minmax(8.5rem,1.15fr) 4.25rem minmax(5.5rem,7.5rem) minmax(4.5rem,6rem) 2.5rem 3rem 4.5rem 3.75rem 3rem 3rem 2.25rem";

const COLS_WITH_STAGE =
  "minmax(8.5rem,1.15fr) 4.25rem 5rem minmax(5.5rem,7.5rem) minmax(4.5rem,6rem) 2.5rem 3rem 4.5rem 3.75rem 3rem 3rem 2.25rem";

export function signalRowGridTemplateColumns(showStageColumn: boolean): string {
  return showStageColumn ? COLS_WITH_STAGE : COLS_NO_STAGE;
}

export function signalRowGridStyle(showStageColumn: boolean): CSSProperties {
  return { gridTemplateColumns: signalRowGridTemplateColumns(showStageColumn) };
}

/** Shared layout classes for row header and body grids. */
export const SIGNAL_ROW_GRID_CLASS = "grid w-full items-center gap-x-3";

/** Minimum table width on desktop (matches column template). */
export const SIGNAL_ROW_TABLE_MIN_WIDTH = "52rem";

/** Tailwind min-width class — keep in sync with SIGNAL_ROW_TABLE_MIN_WIDTH. */
export const SIGNAL_ROW_TABLE_MIN_CLASS = "md:min-w-[52rem]";
