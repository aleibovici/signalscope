import { type ReactNode } from "react";

const variants: Record<string, string> = {
  default:
    "bg-gray-100 text-gray-800 dark:bg-zinc-800/90 dark:text-zinc-200",
  success:
    "bg-green-100 text-green-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  warning:
    "bg-yellow-100 text-yellow-800 dark:bg-amber-950/50 dark:text-amber-200",
  danger: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  purple:
    "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300",
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
