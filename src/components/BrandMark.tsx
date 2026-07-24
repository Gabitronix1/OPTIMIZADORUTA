type BrandMarkProps = {
  className?: string;
  withWordmark?: boolean;
  wordmarkClassName?: string;
};

/** Isotipo inspirado en el logo de Doña Isidora: franjas diagonales en verde lima y verde pino. */
export default function BrandMark({ className, withWordmark, wordmarkClassName }: BrandMarkProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <svg viewBox="0 0 44 40" className="h-8 w-9 shrink-0" aria-hidden="true">
        <polygon points="2,38 14,38 30,4 18,4" fill="var(--color-brand-500)" />
        <polygon points="15,38 25,38 41,4 31,4" fill="var(--color-brand-400)" />
        <polygon points="21,38 31,38 41,16 31,16" fill="var(--color-pine-700)" />
      </svg>
      {withWordmark && (
        <span className={`font-bold uppercase leading-none tracking-tight text-pine-800 ${wordmarkClassName ?? ""}`}>
          Doña Isidora
        </span>
      )}
    </span>
  );
}
