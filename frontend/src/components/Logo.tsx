// Brand wordmark. The artwork (barcode-style "CodigoAR") lives in
// /public/logo.png as a trimmed, transparent PNG so it sits on any background.
type LogoSize = 'sm' | 'lg' | 'xl';

const HEIGHT: Record<LogoSize, string> = {
  sm: 'h-8',
  lg: 'h-16 sm:h-20',
  xl: 'h-24 sm:h-32',
};

export function Logo({ size = 'sm', className = '' }: { size?: LogoSize; className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="CodigoAR"
      className={`${HEIGHT[size]} w-auto select-none ${className}`}
      draggable={false}
    />
  );
}
