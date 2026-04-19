import { type ReactNode } from "react";

const variants: Record<string, string> = {
  default:
    "bg-surface-muted text-label ring-1 ring-border-strong/50",
  success:
    "bg-green-100 text-green-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-1 dark:ring-emerald-500/30",
  warning:
    "bg-yellow-100 text-yellow-800 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-1 dark:ring-amber-500/30",
  danger: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 dark:ring-1 dark:ring-red-500/30",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-1 dark:ring-blue-500/30",
  purple:
    "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 dark:ring-1 dark:ring-purple-500/30",
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children: ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant] || variants.default} ${className}`}
    >
      {children}
    </span>
  );
}
