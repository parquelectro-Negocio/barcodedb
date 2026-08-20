// Brand mark: barcode bars above the "CodigoAR" wordmark.
// The bars inherit the current text color (bg-current), so a parent can tint
// them; the height comes from a Tailwind height class on the container.

const MARK_BARS = [3, 1, 2, 1, 1, 3, 1, 2, 1, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1, 3];

export function BarcodeMark({ className = 'h-3' }: { className?: string }) {
  return (
    <div className={`flex items-stretch gap-[1.5px] ${className}`} aria-hidden="true">
      {MARK_BARS.map((w, i) => (
        <span key={i} className="rounded-[0.5px] bg-current" style={{ width: `${w}px` }} />
      ))}
    </div>
  );
}

type LogoSize = 'sm' | 'lg';

// Stacked lockup: bars centered above the wordmark. "AR" is accented so the
// name reads as clearly Argentine at a glance.
export function Logo({ size = 'sm', className = '' }: { size?: LogoSize; className?: string }) {
  const barsH = size === 'lg' ? 'h-6' : 'h-3';
  const textSize = size === 'lg' ? 'text-4xl sm:text-5xl' : 'text-lg';
  return (
    <div className={`inline-flex flex-col items-center leading-none ${className}`}>
      <BarcodeMark className={`${barsH} text-emerald-600 mb-1`} />
      <span className={`font-extrabold tracking-tight ${textSize}`}>
        <span className="text-stone-800">Codigo</span>
        <span className="text-emerald-600">AR</span>
      </span>
    </div>
  );
}
