"use client";

import { useState, useEffect, useCallback } from "react";

const TOUR_KEY = "signalscope_tour_v1";

// Sidebar breakpoint matches Tailwind md: (768px)
const MOBILE_BREAKPOINT = 768;

interface Step {
  targetId?: string;
  title: string;
  body: string;
  placement: "right" | "bottom" | "center";
  /** Open the mobile sidebar to reveal this element before spotlighting */
  requiresSidebar?: boolean;
}

const STEPS: Step[] = [
  {
    title: "Welcome to SignalScope",
    body: "Let's walk you through the platform in under a minute. Hit Next to start, or skip anytime.",
    placement: "center",
  },
  {
    targetId: "tour-signals",
    title: "Signal Feed",
    body: "Breakout tickers scored by AI from 8 sources — Reddit, SEC filings, congressional trades, options flow, and more. This updates every morning before market open.",
    placement: "right",
    requiresSidebar: true,
  },
  {
    targetId: "tour-trending",
    title: "Trending Tickers",
    body: "Tickers that keep surfacing across multiple scans. The more appearances, the stronger the signal conviction.",
    placement: "right",
    requiresSidebar: true,
  },
  {
    targetId: "tour-performance",
    title: "Performance Tracker",
    body: "Real returns for every AI-scored pick — tracked at 1-day, 3-day, 7-day, and 30-day intervals from the moment of detection.",
    placement: "right",
    requiresSidebar: true,
  },
  {
    targetId: "tour-paper-trading",
    title: "Paper Trading",
    body: "Practice with simulated positions tied to live prices — open and close trades, track P&L, and compare your results to the S&P 500 without risking real capital.",
    placement: "right",
    requiresSidebar: true,
  },
  {
    targetId: "tour-ticker-card",
    title: "Signal Card",
    body: "Each card shows AI Confidence (evidence strength) and Opportunity score (early-mover rank). Click any card for the full AI report, thesis, risks, and trade setup.",
    placement: "right",
  },
  {
    targetId: "tour-search",
    title: "Quick Search",
    body: "Look up any ticker to see its signal history, AI analysis, and trade setup — all in one place.",
    placement: "bottom",
    requiresSidebar: true,
  },
  {
    title: "You're ready to go",
    body: "Signals refresh daily before market open. Bookmark a few tickers to your watchlist and they'll float to the top of your feed.",
    placement: "center",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

const TOOLTIP_WIDTH = 288; // w-72
const TOOLTIP_MARGIN = 12;

function getTargetRect(id: string): Rect | null {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // If element is off-screen (mobile sidebar hidden), skip it
  if (r.right <= 0 || r.bottom <= 0) return null;
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: r.height,
    right: r.right,
    bottom: r.bottom,
  };
}

function TooltipArrow({
  placement,
  arrowOffset,
}: {
  placement: "right" | "bottom" | "center";
  arrowOffset?: number;
}) {
  if (placement === "right") {
    return (
      <span
        className="absolute -left-2 top-1/2 -translate-y-1/2 border-[8px] border-transparent border-r-white dark:border-r-zinc-900"
        aria-hidden="true"
      />
    );
  }
  if (placement === "bottom") {
    return (
      <span
        className="absolute -top-2 -translate-x-1/2 border-[8px] border-transparent border-b-white dark:border-b-zinc-900"
        style={{ left: arrowOffset ?? "50%" }}
        aria-hidden="true"
      />
    );
  }
  return null;
}

export function Tour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Show tour on first visit
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(TOUR_KEY)) return;
    const t = setTimeout(() => setVisible(true), 700);
    return () => clearTimeout(t);
  }, []);

  // Compute target rect whenever step changes
  const updateRect = useCallback(() => {
    if (!visible) return;
    const current = STEPS[step];
    setRect(current.targetId ? getTargetRect(current.targetId) : null);
  }, [step, visible]);

  useEffect(() => {
    if (!visible) return;
    const current = STEPS[step];
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;

    if (current.requiresSidebar && isMobile) {
      // Open the sidebar, then wait for the slide-in animation (200ms) before measuring
      window.dispatchEvent(new Event("tour:open-sidebar"));
      const t = setTimeout(updateRect, 280);
      return () => clearTimeout(t);
    } else {
      if (isMobile) {
        // Leaving a sidebar step — close the sidebar
        window.dispatchEvent(new Event("tour:close-sidebar"));
      }
      const t = setTimeout(() => {
        // On mobile, scroll target into view so the tooltip doesn't overflow
        if (isMobile && current.targetId) {
          const el = document.getElementById(current.targetId);
          el?.scrollIntoView({ behavior: "instant", block: "center" });
        }
        updateRect();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [visible, updateRect, step]);

  // Recompute position on resize/scroll
  useEffect(() => {
    if (!visible) return;
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [visible, updateRect]);

  const dismiss = useCallback(() => {
    localStorage.setItem(TOUR_KEY, "1");
    setVisible(false);
    // Always close the sidebar when the tour ends
    window.dispatchEvent(new Event("tour:close-sidebar"));
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  // Keyboard: Escape to dismiss, Enter/Right for next
  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
      if (e.key === "Enter" || e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, dismiss, next]);

  if (!visible) return null;

  const current = STEPS[step];
  // Fall back to center if the target element isn't visible (e.g. mobile sidebar hidden)
  const isCenter = current.placement === "center" || (current.targetId != null && !rect);

  // ---- Tooltip position (clamped to viewport) ----
  let tooltipStyle: React.CSSProperties = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  };
  let arrowOffset: number | undefined;
  let effectivePlacement: "right" | "bottom" | "center" = "center";

  if (!isCenter && rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // On mobile, sidebar steps have no room to the right — use bottom placement
    const resolvedPlacement =
      current.placement === "right" && vw < MOBILE_BREAKPOINT ? "bottom" : current.placement;
    effectivePlacement = resolvedPlacement;

    if (resolvedPlacement === "right") {
      let left = rect.right + 16;
      // Flip to left if overflowing right
      if (left + TOOLTIP_WIDTH > vw - TOOLTIP_MARGIN) {
        left = rect.left - TOOLTIP_WIDTH - 16;
      }
      let top = rect.top + rect.height / 2;
      // Clamp vertically so tooltip stays in viewport (200px ≈ max tooltip height)
      top = Math.max(TOOLTIP_MARGIN, Math.min(top, vh - 200));
      tooltipStyle = {
        position: "fixed",
        top,
        left: Math.max(TOOLTIP_MARGIN, left),
        transform: "translateY(-50%)",
      };
    } else if (resolvedPlacement === "bottom") {
      const idealLeft = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      const clampedLeft = Math.max(
        TOOLTIP_MARGIN,
        Math.min(idealLeft, vw - TOOLTIP_WIDTH - TOOLTIP_MARGIN)
      );
      arrowOffset = rect.left + rect.width / 2 - clampedLeft;
      tooltipStyle = {
        position: "fixed",
        top: rect.bottom + 16,
        left: clampedLeft,
      };
    }
  }

  return (
    <>
      {/* Backdrop — either plain overlay or spotlight cutout */}
      {isCenter || !rect ? (
        <div
          className="fixed inset-0 z-[9990] bg-black/50 transition-opacity"
          onClick={dismiss}
          aria-hidden="true"
        />
      ) : (
        <>
          {/* Click-away area behind the spotlight */}
          <div
            className="fixed inset-0 z-[9989]"
            onClick={dismiss}
            aria-hidden="true"
          />
          {/* Spotlight ring with massive box-shadow as dimmer */}
          <div
            className="pointer-events-none fixed z-[9990] transition-all duration-200"
            style={{
              top: rect.top - 4,
              left: rect.left - 4,
              width: rect.width + 8,
              height: rect.height + 8,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.52)",
              outline: "2px solid #3b82f6",
              outlineOffset: "2px",
              borderRadius: "8px",
            }}
            aria-hidden="true"
          />
        </>
      )}

      {/* Tooltip bubble */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={current.title}
        className="fixed z-[9991] w-72 rounded-xl bg-white shadow-2xl dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-700"
        style={tooltipStyle}
      >
        <TooltipArrow placement={effectivePlacement} arrowOffset={arrowOffset} />

        <div className="p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
              {step + 1} / {STEPS.length}
            </span>
            <button
              onClick={dismiss}
              aria-label="Close tour"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <h3 className="mb-1.5 text-sm font-semibold text-gray-900 dark:text-zinc-100">
            {current.title}
          </h3>
          <p className="mb-4 text-xs leading-relaxed text-gray-600 dark:text-zinc-400">
            {current.body}
          </p>

          {/* Progress dots */}
          <div className="mb-3 flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step
                    ? "w-4 bg-blue-600 dark:bg-blue-400"
                    : i < step
                      ? "w-1.5 bg-blue-300 dark:bg-blue-700"
                      : "w-1.5 bg-gray-200 dark:bg-zinc-700"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={dismiss}
              className="text-xs text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              Skip tour
            </button>
            <button
              onClick={next}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {step === STEPS.length - 1 ? "Get started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
