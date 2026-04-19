export function EmptyState({
  message,
  variant = "box",
}: {
  message: string;
  variant?: "box" | "inline";
}) {
  if (variant === "inline") {
    return (
      <p className="py-6 text-center text-sm text-muted">{message}</p>
    );
  }
  return (
    <div className="rounded-lg border border-dashed border-border-strong/50 py-12 text-center dark:border-border-strong/30">
      <p className="text-secondary">{message}</p>
    </div>
  );
}
