import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

export function ProductDetail() {
  const { barcode } = useParams();

  const { data: product, isLoading, error } = useQuery({
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
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
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

          <span className={`inline-block text-xs px-3 py-1 rounded ${
            product.status === 'verified' ? 'bg-emerald-900 text-emerald-300' : 'bg-yellow-900 text-yellow-300'
          }`}>
            {product.status === 'verified' ? 'Verificado' : 'Pendiente de verificación'}
          </span>

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
