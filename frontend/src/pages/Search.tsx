import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

const API = '/api';

export function Search() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const brand = params.get('brand') ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['search', q, brand],
    queryFn: async () => {
      const url = `${API}/search?q=${encodeURIComponent(q)}&brand=${encodeURIComponent(brand)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Search failed');
      return res.json();
    },
    enabled: !!q || !!brand,
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">
        {q ? `Resultados para "${q}"` : brand ? `Marca: ${brand}` : 'Búsqueda'}
      </h2>

      {isLoading && <p className="text-slate-400">Buscando...</p>}

      {data?.data?.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p className="mb-4">No encontramos resultados.</p>
          <Link
            to={`/add?barcode=${q}`}
            className="inline-block px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white"
          >
            Agregar producto
          </Link>
        </div>
      )}

      <div className="grid gap-4">
        {data?.data?.map((product: any) => (
          <Link
            key={product.id}
            to={`/product/${product.barcode}`}
            className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4
                       hover:border-slate-600 transition-colors"
          >
            {product.imageUrl ? (
              <img src={product.imageUrl} alt="" className="w-16 h-16 object-cover rounded" />
            ) : (
              <div className="w-16 h-16 bg-slate-800 rounded flex items-center justify-center text-slate-600">
                ?
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{product.name}</p>
              <p className="text-sm text-slate-400">{product.brand}</p>
              <p className="text-xs text-slate-500 font-mono">{product.barcode}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${
              product.status === 'verified' ? 'bg-emerald-900 text-emerald-300' : 'bg-yellow-900 text-yellow-300'
            }`}>
              {product.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
