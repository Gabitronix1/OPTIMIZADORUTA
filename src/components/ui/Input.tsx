import type { InputHTMLAttributes, ReactNode } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: ReactNode;
};

export default function Input({ icon, className, ...rest }: InputProps) {
  return (
    <div className={`relative ${className ?? ""}`}>
      {icon && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400">{icon}</span>}
      <input
        className={`w-full rounded-lg border border-neutral-300 bg-white py-2 text-sm shadow-sm outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-100 disabled:bg-neutral-100 disabled:text-neutral-500 ${icon ? "pl-9" : "pl-3"} pr-3`}
        {...rest}
      />
    </div>
  );
}
