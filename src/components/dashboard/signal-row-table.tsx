import type { ReactNode } from "react";
import { SIGNAL_ROW_TABLE_MIN_CLASS } from "@/lib/signal-row-grid";

type SignalRowTableProps = {
  caption: string;
  header: ReactNode;
  children: ReactNode;
};

/** Accessible table shell for signal row view — sticky header on desktop. */
export function SignalRowTable({ caption, header, children }: SignalRowTableProps) {
  return (
    <div className="md:overflow-x-auto">
      <div role="table" aria-label={caption} className={`min-w-0 ${SIGNAL_ROW_TABLE_MIN_CLASS}`}>
        <div
          role="rowgroup"
          className="sticky top-0 z-10 hidden border-b border-border-default/50 bg-gray-50/95 backdrop-blur-sm dark:bg-zinc-950/95 md:block"
        >
          {header}
        </div>
        <div role="rowgroup" className="divide-y divide-border-default/40">
          {children}
        </div>
      </div>
    </div>
  );
}
