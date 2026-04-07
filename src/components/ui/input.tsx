import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, className = "", ...props }: InputProps) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
      {label ? <span>{label}</span> : null}
      <input
        className={`rounded-md border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 outline-none placeholder:text-slate-500 focus:border-cyan-300/60 ${className}`}
        {...props}
      />
      {error ? <span className="text-[10px] font-medium text-rose-400">{error}</span> : null}
    </label>
  );
}
