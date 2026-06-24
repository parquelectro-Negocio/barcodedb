import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

export function ProductDetail() {
  const { barcode } = useParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['product', barcode],
    queryFn: async () => {
      const res = await fetch(`/api/products/${barcode}`);
      if (!res.ok) throw new Error('Product not found');
      return res.json();
    },
    enabled: !!barcode,
  });

  if (isLoading) return <p className="text-slate-400">Cargando...</p>;
  if (error) return (
    <div className="text-center py-12">
      <p className="text-slate-500 mb-4">Producto no encontrado</p>
      <p className="text-sm text-slate-600">Código: {barcode}</p>
      <Link
        to={`/add?barcode=${barcode}`}
        className="inline-block mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium"
      >
        Agregar producto
      </Link>
    </div>
  );

  // --- Barcode conflict: show all entries sorted by verification_score ---
  if (data.conflict && !selectedId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-6 text-yellow-200 text-sm">
          Este código de barras tiene {data.products.length} productos registrados.
          Seleccioná el correcto:
        </div>

        <div className="grid gap-4">
          {data.products.map((p: any) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className="flex items-center gap-4 bg-slate-900 border border-slate-700 rounded-lg p-4
                         hover:border-emerald-500 transition-colors text-left"
            >
              <div className="w-16 h-16 bg-slate-800 rounded flex items-center justify-center text-slate-600">
                {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover rounded" /> : '?'}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-slate-400">{p.brand}</p>
                <p className="text-xs text-slate-500">{p.verification_score} confirmaciones</p>
              </div>
              {p.status === 'verified' && (
                <span className="text-xs px-2 py-1 bg-emerald-900 text-emerald-300 rounded">Verificado</span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- Single product view ---
  const product = data.conflict
    ? data.products.find((p: any) => p.id === selectedId)
    : data.products[0];

  if (!product) return null;

  return (
    <div className="max-w-2xl mx-auto">
      {data.conflict && (
        <button
          onClick={() => setSelectedId(null)}
          className="text-sm text-slate-500 hover:text-white mb-4"
        >
          &larr; Ver todos los productos para este código
        </button>
      )}

      <div className="flex gap-8 items-start">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" className="w-48 h-48 object-cover rounded-xl" />
        ) : (
          <div className="w-48 h-48 bg-slate-800 rounded-xl flex items-center justify-center text-slate-600 text-lg">
            Sin imagen
          </div>
        )}

        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
          {product.brand && <p className="text-lg text-slate-400 mb-2">{product.brand}</p>}
          <p className="text-sm font-mono text-slate-500 mb-4">{product.barcode}</p>

          <div className="flex gap-2">
            <span className={`text-xs px-3 py-1 rounded ${
              product.status === 'verified' ? 'bg-emerald-900 text-emerald-300' : 'bg-yellow-900 text-yellow-300'
            }`}>
              {product.status === 'verified' ? 'Verificado' : 'Pendiente'}
            </span>
            <span className="text-xs px-3 py-1 rounded bg-slate-800 text-slate-400">
              {product.verification_score} confirmaciones
            </span>
          </div>

          {product.description && (
            <p className="mt-4 text-slate-300">{product.description}</p>
          )}
        </div>
      </div>

      {product.variants?.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-3">Variantes</h3>
          <div className="grid grid-cols-2 gap-3">
            {product.variants.map((v: any) => (
              <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                <p className="font-medium">{v.name}</p>
                {v.barcode && <p className="text-xs font-mono text-slate-500">{v.barcode}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
