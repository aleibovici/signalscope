import { type ReactNode, type ButtonHTMLAttributes, forwardRef } from "react";
import Link, { type LinkProps } from "next/link";

const variants = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500/40 dark:bg-blue-500 dark:hover:bg-blue-600",
  secondary:
    "border border-border-input bg-surface-card text-label shadow-sm hover:bg-surface-subtle dark:hover:bg-surface-muted focus-visible:ring-border-strong/40",
  ghost:
    "text-label hover:bg-surface-subtle dark:hover:bg-surface-muted focus-visible:ring-border-strong/40",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/40 dark:bg-red-500 dark:hover:bg-red-600",
} as const;

const sizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-4 text-sm",
} as const;

const base =
  "inline-flex items-center gap-2 rounded-lg font-medium transition-[background-color,box-shadow,border-color,color] duration-base focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

export interface ButtonLinkProps extends Omit<LinkProps, "className"> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </Link>
  );
}
