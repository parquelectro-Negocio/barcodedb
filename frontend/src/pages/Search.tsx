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
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Buscá por nombre, marca o código de barras..."
            className="w-full pl-12 pr-14 py-3 bg-white border border-stone-200 rounded-xl text-lg text-stone-900
                       placeholder:text-stone-400 shadow-card
                       focus:outline-none focus:border-emerald-500 focus:shadow-card-hover
                       transition-all duration-200"
            autoFocus
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white font-medium transition-colors"
          >
            Buscar
          </button>
        </div>
      </form>

      {!q && !brand && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-stone-400">Escribí algo para empezar a buscar.</p>
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 flex items-center gap-4">
              <div className="skeleton w-16 h-16 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {q && !isLoading && data?.data?.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
            </svg>
          </div>
          <p className="text-stone-500 mb-2">No encontramos resultados para "{q}"</p>
          <p className="text-sm text-stone-400 mb-6">¿El producto no está registrado? Agregalo.</p>
          <Link
            to={`/add?name=${encodeURIComponent(q)}`}
            className="btn-primary"
          >
            Agregar producto
          </Link>
        </div>
      )}

      {data?.data?.length > 0 && (
        <>
          <p className="text-sm text-stone-500 mb-4">
            {total} resultado{total !== 1 ? 's' : ''} &middot; Página {page} de {totalPages}
          </p>

          <div className="grid gap-3">
            {data?.data?.map((product: any) => (
              <Link
                key={product.id}
                to={`/product/${product.barcode || product.slug}`}
                className="card p-4 flex items-center gap-4 hover:border-emerald-300 group"
              >
                {product.imageUrl ? (
                  <img src={resolveImageUrl(product.imageUrl)} alt="" className="w-16 h-16 object-cover rounded-xl shrink-0" />
                ) : (
                  <div className="w-16 h-16 bg-stone-100 rounded-xl flex items-center justify-center text-stone-400 text-lg shrink-0 group-hover:bg-emerald-50 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-stone-900 group-hover:text-emerald-700 transition-colors">{product.name}</p>
                  <div className="flex items-center gap-3 text-sm text-stone-400 mt-0.5">
                    {product.brand && <span>{product.brand}</span>}
                    <span className="font-mono text-xs">{product.barcode}</span>
                  </div>
                  {product.category && (
                    <span className="text-xs text-stone-400 mt-0.5 block">{product.category.name}</span>
                  )}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-lg font-medium shrink-0 ${
                  product.status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                  product.status === 'flagged' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {product.status === 'verified' ? 'Verificado' :
                   product.status === 'flagged' ? 'Reportado' : 'Pendiente'}
                </span>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="btn-secondary text-sm"
              >
                ← Anterior
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                .map((p, i, arr) => (
                  <span key={p} className="flex items-center">
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-stone-300 text-sm">...</span>}
                    <button
                      onClick={() => goToPage(p)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        p === page ? 'bg-emerald-600 text-white shadow-sm' : 'btn-secondary text-sm p-0'
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                ))}

              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="btn-secondary text-sm"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
