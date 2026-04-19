import { type ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  meta,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`min-w-0 ${action ? "flex items-start justify-between gap-4" : ""}`}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-primary md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-pretty text-sm leading-relaxed text-secondary">{subtitle}</p>}
        {meta && <p className="mt-0.5 text-xs text-muted">{meta}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
