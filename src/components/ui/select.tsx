import type { SelectHTMLAttributes } from "react";

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: SelectOption[];
  error?: string;
};

export function Select({ label, options, error, className = "", ...props }: SelectProps) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700">
      {label ? <span>{label}</span> : null}
      <select
        className={`rounded-md border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-cyan-300/60 ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-[10px] font-medium text-rose-400">{error}</span> : null}
    </label>
  );
}
