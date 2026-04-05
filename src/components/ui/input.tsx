import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, className = "", ...props }: InputProps) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
      <span>{label}</span>
      <input
        className={`rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none ring-slate-200 placeholder:text-slate-400 focus:ring-2 ${className}`}
        {...props}
      />
      {error ? <span className="text-[10px] font-medium text-rose-600">{error}</span> : null}
    </label>
  );
}
