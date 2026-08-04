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

  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then(r => r.json())
      .then((cats: Cat[]) => setAllSectors(cats.filter(c => !c.parentId)))
      .catch(() => {});
  }, []);

  useEffect(() => { setSelected(sectors ?? []); }, [sectors]);

  const toggle = async (sectorSlug: string) => {
    const prev = selected;
    const next = selected.includes(sectorSlug)
      ? selected.filter(s => s !== sectorSlug)
      : [...selected, sectorSlug];
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

  if (allSectors.length === 0) return null;

  return (
    <div className="card p-4 mb-5">
      <p className="text-sm font-semibold text-stone-700 mb-1">Mis rubros</p>
      <p className="text-xs text-stone-400 mb-3">
        Elegí qué vendés — así al cargar productos ves solo las categorías que te sirven.
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
      </div>
    </div>
  );
}
