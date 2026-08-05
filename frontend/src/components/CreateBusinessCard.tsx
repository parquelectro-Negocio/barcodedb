import { useState, useEffect } from 'react';
import { API_BASE } from '../lib/config';
import { apiHeaders } from '../lib/user';
import { useToast } from '../lib/toast';

type Cat = { id: string; name: string; slug: string; parentId: string | null };

// First-run onboarding: a new owner names their shop and picks what they sell.
export function CreateBusinessCard({ onCreated }: { onCreated: (slug: string) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [sectors, setSectors] = useState<string[]>([]);
  const [allSectors, setAllSectors] = useState<Cat[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then(r => r.json())
      .then((c: Cat[]) => setAllSectors(c.filter(x => !x.parentId)))
      .catch(() => {});
  }, []);

  const toggle = (slug: string) =>
    setSectors(s => (s.includes(slug) ? s.filter(x => x !== slug) : [...s, slug]));

  const create = async () => {
    if (!name.trim()) { toast('Poné el nombre de tu comercio', 'error'); return; }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/businesses`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ name: name.trim(), sectors }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error === 'slug_taken' ? 'Ya existe un comercio con ese nombre' : 'No se pudo crear el comercio', 'error');
        return;
      }
      toast('¡Comercio creado!', 'success');
      onCreated(data.slug);
    } catch {
      toast('Error al crear el comercio', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto card p-6 mb-8">
      <h2 className="text-xl font-bold text-stone-800 mb-1">Creá tu comercio</h2>
      <p className="text-sm text-stone-500 mb-5">
        En 2 minutos: ponele nombre, elegí qué vendés y empezá a cargar tu inventario.
      </p>

      <label className="block text-sm font-medium text-stone-700 mb-1">Nombre del comercio</label>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && create()}
        placeholder="Ej: Mi Kiosco"
        className="input mb-4"
        autoFocus
      />

      {allSectors.length > 0 && (
        <>
          <label className="block text-sm font-medium text-stone-700 mb-2">¿Qué vendés? (elegí uno o más)</label>
          <div className="flex flex-wrap gap-2 mb-6">
            {allSectors.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.slug)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sectors.includes(s.slug) ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </>
      )}

      <button onClick={create} disabled={creating} className="btn-primary w-full">
        {creating ? 'Creando...' : 'Crear comercio'}
      </button>
    </div>
  );
}
