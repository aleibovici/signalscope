import { type ReactNode } from "react";

export function Card({
  children,
  className = "",
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div
      title={title}
      className={`rounded-lg border border-gray-200 bg-white shadow-sm dark:border-zinc-800/90 dark:bg-[#12181f] dark:shadow-[0_1px_3px_rgba(0,0,0,0.35)] ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-b border-gray-200 px-4 py-3 md:px-6 md:py-4 dark:border-zinc-800 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-4 py-3 md:px-6 md:py-4 ${className}`}>{children}</div>;
}
