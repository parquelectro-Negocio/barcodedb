import { useState, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { API_BASE, resolveImageUrl } from '../lib/config';
const PAGE_SIZE = 20;

function isBarcode(s: string): boolean {
  return /^\d{8,14}$/.test(s.trim());
}

export function Search() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get('q') ?? '';
  const brand = params.get('brand') ?? '';
  const page = parseInt(params.get('page') ?? '1');
  const [input, setInput] = useState(q);

  const { data, isLoading } = useQuery({
    queryKey: ['search', q, brand, page],
    queryFn: async () => {
      const url = `${API_BASE}/search?q=${encodeURIComponent(q)}&brand=${encodeURIComponent(brand)}&page=${page}&limit=${PAGE_SIZE}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: !!q || !!brand,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = input.trim();
    if (!val) return;
    if (isBarcode(val)) {
      navigate(`/product/${val}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(val)}`);
    }
  };

  const goToPage = useCallback((p: number) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('page', String(p));
      return next;
    }, { replace: true });
  }, [setParams]);

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative max-w-xl">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Buscá por nombre, marca o código de barras..."
            className="w-full px-5 py-3 bg-white border border-stone-300 rounded-xl text-lg text-stone-900
                       focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-stone-400"
            autoFocus
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white"
          >
            Buscar
          </button>
        </div>
      </form>

      {!q && !brand && (
        <p className="text-stone-400 text-center py-12">Escribí algo para empezar a buscar.</p>
      )}

      {isLoading && <p className="text-stone-500">Buscando...</p>}

      {q && !isLoading && data?.data?.length === 0 && (
        <div className="text-center py-12 text-stone-500">
          <p className="mb-4">No encontramos resultados para "{q}".</p>
          <Link
            to={`/add?name=${encodeURIComponent(q)}`}
            className="inline-block px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white"
          >
            Agregar producto
          </Link>
        </div>
      )}

      {data?.data?.length > 0 && (
        <p className="text-sm text-stone-500 mb-4">
          {total} resultado{total !== 1 ? 's' : ''} · Página {page} de {totalPages}
        </p>
      )}

      <div className="grid gap-4">
        {data?.data?.map((product: any) => (
          <Link
            key={product.id}
            to={`/product/${product.barcode}`}
            className="flex items-center gap-4 bg-white border border-stone-200 rounded-lg p-4
                       hover:border-emerald-400 transition-colors shadow-sm"
          >
            {product.imageUrl ? (
              <img src={resolveImageUrl(product.imageUrl)} alt="" className="w-16 h-16 object-cover rounded" />
            ) : (
              <div className="w-16 h-16 bg-stone-100 rounded flex items-center justify-center text-stone-400">
                ?
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-stone-900">{product.name}</p>
              <p className="text-sm text-stone-500">{product.brand}</p>
              <p className="text-xs text-stone-400 font-mono">{product.barcode}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${
              product.status === 'verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {product.status}
            </span>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm text-stone-700"
          >
            ← Anterior
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .map((p, i, arr) => (
              <span key={p} className="flex items-center">
                {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-stone-300">...</span>}
                <button
                  onClick={() => goToPage(p)}
                  className={`px-3 py-1 rounded text-sm ${
                    p === page ? 'bg-emerald-600 text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                  }`}
                >
                  {p}
                </button>
              </span>
            ))}

          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm text-stone-700"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}