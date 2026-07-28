import { useState, useRef, useEffect } from 'react';

type Option = { value: string; label: string };

type Props = {
  value: string;
  onChange: (value: string, option?: Option) => void;
  onSearch: (q: string) => Promise<Option[]>;
  placeholder?: string;
  className?: string;
};

export function Autocomplete({ value, onChange, onSearch, placeholder, className }: Props) {
  const [input, setInput] = useState(value);
  const [results, setResults] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { setInput(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const opts = await onSearch(q.trim());
      setResults(opts);
      setOpen(opts.length > 0);
      setHighlight(0);
    } finally { setLoading(false); }
  };

  const handleInput = (val: string) => {
    setInput(val);
    onChange(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => doSearch(val), 250);
  };

  const select = (opt: Option) => {
    setInput(opt.label);
    onChange(opt.value, opt);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[highlight]) { e.preventDefault(); select(results[highlight]); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={input}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => { if (results.length) setOpen(true); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={`w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 ${className ?? ''}`}
      />
      {loading && <span className="absolute right-3 top-2.5 text-xs text-stone-400">...</span>}
      {open && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {results.map((opt, i) => (
            <li
              key={opt.value}
              onClick={() => select(opt)}
              className={`px-3 py-2 text-sm cursor-pointer ${i === highlight ? 'bg-emerald-50 text-emerald-700' : 'text-stone-700 hover:bg-stone-50'}`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
