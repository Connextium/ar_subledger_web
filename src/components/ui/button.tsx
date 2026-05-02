import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "border bg-[var(--btn-primary-bg)] border-[var(--btn-primary-border)] text-[var(--btn-primary-fg)] hover:bg-[var(--btn-primary-bg-hover)]",
  secondary:
    "border bg-[var(--btn-secondary-bg)] border-[var(--btn-secondary-border)] text-[var(--btn-secondary-fg)] hover:bg-[var(--btn-secondary-bg-hover)]",
  danger:
    "border bg-[var(--btn-danger-bg)] border-[var(--btn-danger-border)] text-[var(--btn-danger-fg)] hover:bg-[var(--btn-danger-bg-hover)]",
  ghost:
    "border border-transparent bg-transparent text-[var(--btn-ghost-fg)] hover:border-[var(--btn-ghost-border-hover)] hover:bg-[var(--btn-ghost-bg-hover)]",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-2.5 py-1 text-[11px]",
  md: "px-3 py-1.5 text-xs",
  lg: "px-3.5 py-2 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-md font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
