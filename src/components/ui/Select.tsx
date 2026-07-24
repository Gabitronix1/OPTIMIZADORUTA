import type { ReactNode, SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  icon?: ReactNode;
};

export default function Select({ icon, className, children, ...rest }: SelectProps) {
  return (
    <div className={`relative ${className ?? ""}`}>
      {icon && <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400">{icon}</span>}
      <select
        className={`w-full appearance-none rounded-lg border border-neutral-300 bg-white py-2 text-sm shadow-sm outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-100 ${icon ? "pl-9" : "pl-3"} pr-8`}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-neutral-400" />
    </div>
  );
}
