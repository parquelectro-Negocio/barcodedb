import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE, uploadImage } from '../lib/config';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

type Status = 'pending' | 'uploading' | 'done' | 'failed' | 'nomatch';
type Item = { file: File; key: string; productId?: string; status: Status };

// Derive the match key from a filename: drop the extension, trim, and strip
// spaces so it lines up with the space-free barcodes stored in the DB.
function keyFromName(name: string): string {
  return name.replace(/\.[^.]+$/, '').trim().replace(/\s+/g, '');
}

// Run async tasks with a bounded pool so hundreds of uploads don't fire at once.
async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

export function BulkImagesPage() {
  const { authHeaders } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const onPick = (files: FileList | null) => {
    if (!files) return;
    const list: Item[] = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({ file: f, key: keyFromName(f.name), status: 'pending' as Status }));
    setItems(list);
    setProgress(0);
  };

  const setStatus = (key: string, status: Status) =>
    setItems(prev => prev.map(it => (it.key === key ? { ...it, status } : it)));

  const run = async () => {
    if (!items.length || running) return;
    setRunning(true);
    try {
      // 1. Resolve all filenames to product IDs in one batched call.
      const keys = [...new Set(items.map(it => it.key))];
      const res = await fetch(`${API_BASE}/products/find-by-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ keys }),
      });
      if (!res.ok) throw new Error('No se pudo buscar los productos');
      const { map } = (await res.json()) as { map: Record<string, string> };

      // Compute matches synchronously from the map — do NOT rely on a setItems
      // updater to populate `matched`, since React runs that updater later.
      const matched: Item[] = [];
      const next: Item[] = items.map(it => {
        const productId = map[it.key];
        if (productId) {
          const withId = { ...it, productId, status: 'pending' as Status };
          matched.push(withId);
          return withId;
        }
        return { ...it, status: 'nomatch' as Status };
      });
      setItems(next);

      if (!matched.length) {
        toast('Ninguna imagen coincidió con un código o SKU', 'error');
        return;
      }

      // 2. Upload + assign each matched image with bounded concurrency.
      let done = 0;
      await pool(matched, 4, async (it) => {
        setStatus(it.key, 'uploading');
        try {
          const url = await uploadImage(it.file);
          const r = await fetch(`${API_BASE}/products/${it.productId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ imageUrl: url }),
          });
          setStatus(it.key, r.ok ? 'done' : 'failed');
        } catch {
          setStatus(it.key, 'failed');
        } finally {
          done++;
          setProgress(Math.round((done / matched.length) * 100));
        }
      });

      toast(`Listo: ${matched.length} imágenes procesadas`, 'success');
    } catch (e: any) {
      toast(e?.message || 'Error al procesar', 'error');
    } finally {
      setRunning(false);
    }
  };

  const counts = {
    total: items.length,
    done: items.filter(i => i.status === 'done').length,
    failed: items.filter(i => i.status === 'failed').length,
    nomatch: items.filter(i => i.status === 'nomatch').length,
  };
  const nomatchList = items.filter(i => i.status === 'nomatch');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link to="/import" className="text-sm text-stone-400 hover:text-stone-600">← Importar productos</Link>
        <h1 className="text-2xl font-bold text-stone-800 mt-2">Cargar imágenes en lote</h1>
        <p className="text-stone-500 mt-1 text-sm">
          Subí muchas fotos de una vez. Cada archivo se asigna al producto cuyo{' '}
          <strong>código de barras</strong> o <strong>SKU</strong> coincida con el nombre del archivo.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
        <p className="font-semibold mb-1">Cómo nombrar los archivos</p>
        <p>
          El nombre del archivo (sin la extensión) tiene que ser el código o el SKU. Ejemplos:{' '}
          <code className="bg-amber-100 px-1 rounded">7798137720405.jpg</code> o{' '}
          <code className="bg-amber-100 px-1 rounded">NG-UW04.png</code>. Los espacios se ignoran.
        </p>
      </div>

      <label className="block border-2 border-dashed border-stone-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors">
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={running}
          onChange={(e) => onPick(e.target.files)}
        />
        <div className="text-stone-500">
          <p className="font-medium text-stone-700">Seleccionar imágenes</p>
          <p className="text-xs mt-1">Podés elegir cientos a la vez</p>
        </div>
      </label>

      {items.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-stone-600">
              <strong>{counts.total}</strong> imágenes seleccionadas
            </p>
            <button
              onClick={run}
              disabled={running}
              className="px-5 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors"
            >
              {running ? 'Procesando…' : 'Asignar imágenes'}
            </button>
          </div>

          {(running || progress > 0) && (
            <div className="mb-4">
              <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-stone-500 mt-1 text-right">{progress}%</p>
            </div>
          )}

          <div className="flex gap-4 text-sm mb-4">
            <span className="text-emerald-600">✓ {counts.done} asignadas</span>
            {counts.failed > 0 && <span className="text-red-500">✕ {counts.failed} fallaron</span>}
            {counts.nomatch > 0 && <span className="text-amber-600">? {counts.nomatch} sin coincidencia</span>}
          </div>

          {nomatchList.length > 0 && (
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 text-xs text-stone-500 max-h-48 overflow-y-auto">
              <p className="font-semibold text-stone-600 mb-1">Sin producto que coincida:</p>
              <ul className="space-y-0.5">
                {nomatchList.map(it => (
                  <li key={it.key} className="font-mono">{it.file.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
