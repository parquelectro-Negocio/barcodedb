// Decorative barcode with a scanning-light sweep. Pure CSS, no deps.
// Purely visual, so it's hidden from assistive tech and its motion is
// disabled under prefers-reduced-motion.
const BARS = [4, 2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 4, 1, 3,
  1, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 4, 1, 2, 1, 3, 2];

export function BarcodeStrip() {
  return (
    <div className="mb-5 select-none" aria-hidden="true">
      <div className="relative mx-auto w-fit overflow-hidden px-1">
        <div className="flex h-12 items-end gap-[2px]">
          {BARS.map((w, i) => (
            <span
              key={i}
              className="rounded-[1px] bg-stone-800"
              style={{ width: `${w}px`, height: '100%' }}
            />
          ))}
        </div>
        {/* Scanner light sweeping across the code. */}
        <span
          className="pointer-events-none absolute inset-y-0 left-0 w-12 animate-scan
                     bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent
                     blur-[1px] motion-reduce:hidden"
        />
      </div>
      <p className="mt-1.5 text-center font-mono text-[10px] font-medium tracking-[0.35em] text-stone-800">
        0 750123 456789
      </p>
    </div>
  );
}
