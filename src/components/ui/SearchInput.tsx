import { Search } from "lucide-react";

export default function SearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-neutral-300 bg-white py-2 pr-3 pl-9 text-sm shadow-sm outline-none focus:border-pine-600 focus:ring-2 focus:ring-pine-100"
      />
    </div>
  );
}
