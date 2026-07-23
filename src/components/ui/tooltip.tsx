"use client";

import { type ReactNode } from "react";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

const SIDE_POSITION: Record<Side, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const ALIGN_OVERRIDE: Record<Align, Record<Side, string>> = {
  start: {
    top: "bottom-full left-0 translate-x-0 mb-2",
    bottom: "top-full left-0 translate-x-0 mt-2",
    left: "right-full top-0 translate-y-0 mr-2",
    right: "left-full top-0 translate-y-0 ml-2",
  },
  center: SIDE_POSITION,
  end: {
    top: "bottom-full right-0 translate-x-0 mb-2",
    bottom: "top-full right-0 translate-x-0 mt-2",
    left: "right-full bottom-0 translate-y-0 mr-2",
    right: "left-full bottom-0 translate-y-0 ml-2",
  },
};

export function Tooltip({
  children,
  content,
  side = "top",
  align = "center",
  maxWidth = 240,
}: {
  children: ReactNode;
  content: ReactNode;
  side?: Side;
  align?: Align;
  maxWidth?: number;
}) {
  const position = ALIGN_OVERRIDE[align][side];

  return (
    <span className="group/tip relative inline-flex">
      <span tabIndex={0} className="inline-flex rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50">
        {children}
      </span>
      <span
        role="tooltip"
        style={{ maxWidth }}
        className={`pointer-events-none absolute z-50 ${position} w-max rounded-md border border-border-default bg-surface-overlay px-2.5 py-1.5 type-caption text-primary opacity-0 shadow-overlay transition-opacity duration-fast ease-standard group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 motion-reduce:transition-none`}
      >
        {content}
      </span>
    </span>
  );
}

export function InfoTip({
  text,
  side = "bottom",
  align = "center",
}: {
  text: ReactNode;
  side?: Side;
  align?: Align;
}) {
  return (
    <Tooltip content={text} side={side} align={align}>
      <svg
        aria-hidden
        className="ml-1 h-3.5 w-3.5 shrink-0 align-middle text-muted transition-colors group-hover/tip:text-secondary"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
          clipRule="evenodd"
        />
      </svg>
    </Tooltip>
  );
}
