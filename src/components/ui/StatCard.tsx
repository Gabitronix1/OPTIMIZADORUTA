import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export default function StatCard({
  icon,
  label,
  value,
  to,
  tone = "brand",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  to?: string;
  tone?: "brand" | "pine" | "amber" | "red";
}) {
  const toneClasses: Record<string, string> = {
    brand: "bg-brand-100 text-brand-800",
    pine: "bg-pine-100 text-pine-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
  };

  const content = (
    <>
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-sm text-neutral-500">{label}</p>
        <p className="text-2xl font-semibold text-neutral-900">{value}</p>
      </div>
    </>
  );

  const classes =
    "flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow";

  if (to) {
    return (
      <Link to={to} className={`${classes} hover:shadow-md hover:border-pine-200`}>
        {content}
      </Link>
    );
  }
  return <div className={classes}>{content}</div>;
}
