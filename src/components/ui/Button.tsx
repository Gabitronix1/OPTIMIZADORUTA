import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-pine-800 text-white hover:bg-pine-700 disabled:hover:bg-pine-800",
  secondary: "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50",
  danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  ghost: "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
};

export default function Button({
  variant = "primary",
  size = "md",
  icon,
  loading,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className ?? ""}`}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
