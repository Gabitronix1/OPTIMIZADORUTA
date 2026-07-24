import type { ReactNode } from "react";

export default function PageHeader({
  icon,
  title,
  description,
  actions,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-pine-800 text-white">
            {icon}
          </span>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-neutral-500">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
