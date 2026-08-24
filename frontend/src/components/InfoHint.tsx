import { useState } from 'react';

// Small "?" that reveals a short explanation. Toggles on click so it also works
// on touch (plain CSS hover tooltips don't appear on phones).
export function InfoHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        onBlur={() => setOpen(false)}
        aria-label="Ayuda"
        className="ml-1 w-4 h-4 inline-flex items-center justify-center rounded-full border border-stone-300 text-stone-400 hover:text-stone-600 hover:border-stone-400 text-[10px] font-bold leading-none"
      >
        ?
      </button>
      {open && (
        <span className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1 w-52 px-3 py-2 bg-stone-800 text-white text-xs rounded-lg shadow-lg font-normal normal-case text-left">
          {text}
        </span>
      )}
    </span>
  );
}
