import type { ReactNode } from "react";

export default function EmptyState({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 px-6 py-10 text-center">
      {icon && <span className="text-neutral-300">{icon}</span>}
      <p className="text-sm text-neutral-500">{children}</p>
    </div>
  );
}
