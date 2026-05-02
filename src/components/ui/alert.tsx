import type { HTMLAttributes } from "react";

type AlertVariant = "default" | "destructive";

function getAlertClasses(variant: AlertVariant): string {
  if (variant === "destructive") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-800";
}

export function Alert({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant }) {
  const classes = [
    "relative w-full rounded-lg border px-3 py-2 text-sm",
    "[&>svg]:absolute [&>svg]:left-3 [&>svg]:top-2.5 [&>svg]:h-4 [&>svg]:w-4",
    "[&:has(>svg)]:pl-9",
    getAlertClasses(variant),
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div role="alert" className={classes} {...props} />;
}

export function AlertDescription({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const classes = ["text-sm leading-relaxed", className].filter(Boolean).join(" ");
  return <div className={classes} {...props} />;
}
