import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE, resolveImageUrl } from '../lib/config';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

type Prod = { id: string; name: string; brand: string; barcode: string; sku: string; imageUrl: string };
type Group = { id: string; products: Prod[] };

export function DuplicatesPage() {
  const { user, authHeaders } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [keepers, setKeepers] = useState<Record<string, string>>({});
  const [merging, setMerging] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/duplicates/candidates`, { headers: authHeaders() });
      if (res.ok) {
        const d = await res.json();
        const gs: Group[] = (d.groups || []).map((products: Prod[]) => ({ id: products[0].id, products }));
        setGroups(gs);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  if (!user?.isModerator) {
    return <p className="text-center py-16 text-stone-500">Solo para moderadores.</p>;
  }

  const setKeeper = (gid: string, pid: string) => setKeepers(p => ({ ...p, [gid]: pid }));
  const dismiss = (gid: string) => setGroups(prev => prev.filter(g => g.id !== gid));

  const mergeGroup = async (g: Group) => {
    const keepId = keepers[g.id] ?? g.products[0].id;
    const keeper = g.products.find(p => p.id === keepId);
    const others = g.products.filter(p => p.id !== keepId);
    if (!others.length) return;
    if (!confirm(`Fusionar ${others.length} producto(s) en "${keeper?.name}". Los demás se borran y su inventario/precios pasan a este. ¿Continuar?`)) return;
    setMerging(g.id);
    let ok = 0, fail = 0;
    for (const p of others) {
      try {
        const res = await fetch(`${API_BASE}/duplicates/merge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ keepId, removeId: p.id }),
        });
        if (res.ok) ok++; else fail++;
      } catch { fail++; }
    }
    setMerging(null);
    toast(`Fusionados: ${ok}${fail ? `, ${fail} fallaron` : ''}`, fail ? 'error' : 'success');
    setGroups(prev => prev.filter(x => x.id !== g.id));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link to="/panel" className="text-sm text-stone-400 hover:text-stone-600">← Panel</Link>
        <h1 className="text-2xl font-bold text-stone-800 mt-2">Duplicados</h1>
        <p className="text-stone-500 mt-1 text-sm">
          Productos que parecen ser el mismo (misma marca + modelo). Elegí cuál queda y fusioná el resto:
          el inventario, precios y alias se mueven al que queda y los otros se borran.
        </p>
      </div>

      {loading ? (
        <p className="text-stone-400 text-center py-12">Buscando duplicados…</p>
      ) : groups.length === 0 ? (
        <p className="text-stone-400 text-center py-12">No se detectaron duplicados. 🎉</p>
      ) : (
        <>
          <p className="text-sm text-stone-500 mb-4">{groups.length} grupos con posibles duplicados.</p>
          {groups.map(g => {
            const keepId = keepers[g.id] ?? g.products[0].id;
            return (
              <div key={g.id} className="bg-white border border-stone-200 rounded-xl shadow-sm p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-stone-700">{g.products.length} posibles duplicados</p>
                  <div className="flex gap-2">
                    <button onClick={() => dismiss(g.id)} className="text-xs text-stone-400 hover:text-stone-600">
                      No son duplicados
                    </button>
                    <button
                      onClick={() => mergeGroup(g)}
                      disabled={merging === g.id}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                    >
                      {merging === g.id ? 'Fusionando…' : 'Fusionar el resto en el elegido'}
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-stone-100">
                  {g.products.map(p => (
                    <label key={p.id} className="flex items-center gap-3 py-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`keep-${g.id}`}
                        checked={keepId === p.id}
                        onChange={() => setKeeper(g.id, p.id)}
                        className="accent-emerald-600 shrink-0"
                      />
                      {p.imageUrl
                        ? <img src={resolveImageUrl(p.imageUrl)} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
                        : <div className="w-10 h-10 bg-stone-100 rounded shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-stone-800 truncate">{p.name}</p>
                        <p className="text-xs text-stone-400 truncate">
                          {[p.brand, p.barcode, p.sku && ('SKU ' + p.sku)].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {keepId === p.id && <span className="text-xs text-emerald-600 font-medium shrink-0">se queda</span>}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
