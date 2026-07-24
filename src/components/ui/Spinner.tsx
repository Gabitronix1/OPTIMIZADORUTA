import { Loader2 } from "lucide-react";

export default function Spinner({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-neutral-500">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}
