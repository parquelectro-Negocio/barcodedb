import { useState, useEffect } from 'react';
import { API_BASE } from '../lib/config';
import { apiHeaders } from '../lib/user';
import { useToast } from '../lib/toast';

type Cat = { id: string; name: string; slug: string; parentId: string | null };

// Lets a business owner pick which sectors (top-level categories) the shop
// operates in. Saved on toggle via PATCH /businesses/:slug.
export function SectorPicker({ slug, sectors, onChange }: {
  slug: string;
  sectors: string[];
  onChange?: (sectors: string[]) => void;
}) {
  const { toast } = useToast();
  const [allSectors, setAllSectors] = useState<Cat[]>([]);
  const [selected, setSelected] = useState<string[]>(sectors ?? []);
  const [saving, setSaving] = useState(false);
  const [custom, setCustom] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then(r => r.json())
      .then((cats: Cat[]) => setAllSectors(cats.filter(c => !c.parentId)))
      .catch(() => {});
  }, []);

  useEffect(() => { setSelected(sectors ?? []); }, [sectors]);

  const persist = async (next: string[]) => {
    const prev = selected;
    setSelected(next);
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/businesses/${slug}`, {
        method: 'PATCH',
        headers: apiHeaders(),
        body: JSON.stringify({ sectors: next }),
      });
      if (!res.ok) throw new Error();
      onChange?.(next);
    } catch {
      setSelected(prev);
      toast('No se pudo guardar el rubro', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (value: string) => {
    persist(selected.includes(value) ? selected.filter(s => s !== value) : [...selected, value]);
  };

  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    // If it matches a known rubro name, add its slug so catalog filtering keeps working.
    const known = allSectors.find(c => c.name.toLowerCase() === v.toLowerCase());
    const val = known ? known.slug : v;
    if (selected.some(s => s.toLowerCase() === val.toLowerCase())) { setCustom(''); return; }
    persist([...selected, val]);
    setCustom('');
  };

  if (allSectors.length === 0) return null;

  // Sectors the shop added by hand that aren't one of the shared rubros.
  const knownSlugs = new Set(allSectors.map(c => c.slug));
  const customSectors = selected.filter(v => !knownSlugs.has(v));

  const activeCount = selected.length;

  return (
    <div className="card p-4 mb-5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-sm font-semibold text-stone-700"
      >
        <span>
          Mis rubros
          {activeCount > 0 && <span className="ml-2 text-xs font-normal text-emerald-600">{activeCount} activo{activeCount > 1 ? 's' : ''}</span>}
        </span>
        <span className="text-stone-400">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <>
      <p className="text-xs text-stone-400 mt-3 mb-3">
        Elegí qué vendés — así al cargar productos ves solo las categorías que te sirven.
        ¿No está tu rubro? Agregalo abajo.
      </p>
      <div className="flex flex-wrap gap-2">
        {allSectors.map(s => {
          const on = selected.includes(s.slug);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.slug)}
              disabled={saving}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
                on ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {s.name}
            </button>
          );
        })}

        {customSectors.map(v => (
          <button
            key={v}
            type="button"
            onClick={() => toggle(v)}
            disabled={saving}
            title="Tocá para quitar este rubro"
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white transition-colors disabled:opacity-60 inline-flex items-center gap-1"
          >
            {v} <span className="text-emerald-200">✕</span>
          </button>
        ))}
      </div>

      <div className="flex gap-2 mt-3 max-w-xs">
        <input
          type="text"
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          placeholder="Agregar otro rubro..."
          className="flex-1 px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={saving || !custom.trim()}
          className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 rounded-lg text-sm font-medium text-white disabled:opacity-40"
        >
          Agregar
        </button>
      </div>
        </>
      )}
    </div>
  );
}
