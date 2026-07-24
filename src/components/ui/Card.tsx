import type { CSSProperties, ReactNode } from "react";

export default function Card({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div style={style} className={`rounded-xl border border-neutral-200 bg-white shadow-sm ${className ?? ""}`}>
      {children}
    </div>
  );
}
