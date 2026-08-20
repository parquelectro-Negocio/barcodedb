// Brand wordmark. The artwork (barcode-style "CodigoAR") lives in
// /public/logo.png as a trimmed, transparent PNG so it sits on any background.
type LogoSize = 'sm' | 'lg' | 'xl';

const HEIGHT: Record<LogoSize, string> = {
  sm: 'h-8',
  lg: 'h-16 sm:h-20',
  xl: 'h-24 sm:h-32',
};

export function Logo({ size = 'sm', className = '', scan = false }: {
  size?: LogoSize;
  className?: string;
  scan?: boolean;
}) {
  const img = (
    <img
      src="/logo.png"
      alt="CodigoAR"
      className={`${HEIGHT[size]} w-auto select-none`}
      draggable={false}
    />
  );

  if (!scan) return <span className={`inline-block ${className}`}>{img}</span>;

  // Scanner-light sweep across the wordmark (same animation as the old barcode strip).
  return (
    <span className={`relative inline-block overflow-hidden ${className}`}>
      {img}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-12 animate-scan
                   bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent
                   blur-[1px] motion-reduce:hidden"
      />
    </span>
  );
}
