import type { ReactNode } from "react";

export function EmptyState({
  message,
  variant = "box",
  icon,
  action,
}: {
  message: string;
  variant?: "box" | "inline";
  icon?: ReactNode;
  action?: ReactNode;
}) {
  if (variant === "inline") {
    return (
      <p className="py-6 text-center text-sm text-muted">{message}</p>
    );
  }
  return (
    <div className="rounded-lg border border-dashed border-border-strong/50 py-12 text-center dark:border-border-strong/30">
      {icon && (
        <div className="mb-3 flex justify-center text-muted">{icon}</div>
      )}
      <p className="text-secondary">{message}</p>
      {action && (
        <div className="mt-4 flex justify-center">{action}</div>
      )}
    </div>
  );
}
