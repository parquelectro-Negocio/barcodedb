import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { apiHeaders } from '../lib/user';
import { API_BASE, resolveImageUrl } from '../lib/config';

export function ProductDetail() {
  const { barcode } = useParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['product', barcode],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/products/${barcode}`);
      if (!res.ok) throw new Error('Product not found');
      return res.json();
    },
    enabled: !!barcode,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const productList: any[] = data?.products ?? [];
  const conflict = data?.conflict ?? false;
  const product = conflict
    ? productList.find((p: any) => p.id === selectedId) ?? productList[0]
    : productList[0];

  // If conflict and no selection, show picker
  if (!isLoading && !error && conflict && !selectedId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6 text-yellow-800 text-sm">
          Este código de barras tiene {productList.length} productos registrados.
          Seleccioná el correcto:
        </div>
        <div className="grid gap-4">
          {productList.map((p: any) => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className="flex items-center gap-4 bg-white border border-stone-200 rounded-lg p-4
                         hover:border-emerald-400 transition-colors text-left shadow-sm"
            >
              <div className="w-16 h-16 bg-stone-100 rounded flex items-center justify-center text-stone-400">
                {p.imageUrl ? <img src={resolveImageUrl(p.imageUrl)} alt="" className="w-full h-full object-cover rounded" /> : '?'}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-stone-900">{p.name}</p>
                <p className="text-sm text-stone-500">{p.brand}</p>
                <p className="text-xs text-stone-400">{p.verification_score} confirmaciones</p>
              </div>
              {p.status === 'verified' && (
                <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded">Verificado</span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (isLoading) return <p className="text-stone-500">Cargando...</p>;
  if (error || !product) return (
    <div className="text-center py-12">
      <p className="text-stone-500 mb-4">Producto no encontrado</p>
      <p className="text-sm text-stone-400 font-mono mb-6">{barcode}</p>
      <Link
        to={`/add?barcode=${barcode}`}
        className="inline-block px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white"
      >
        Agregar producto
      </Link>
    </div>
  );

  return <ProductView product={product} barcode={barcode!} onBack={conflict ? () => setSelectedId(null) : undefined} />;
}

function ProductView({ product, barcode, onBack }: { product: any; barcode: string; onBack?: () => void }) {
  const queryClient = useQueryClient();

  const { data: voteData } = useQuery({
    queryKey: ['vote', product.id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/votes/${product.id}`, { headers: apiHeaders() });
      return res.json();
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (vote: 'confirm' | 'flag') => {
      const res = await fetch(`${API_BASE}/votes/${product.id}`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ vote }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vote', product.id] });
      queryClient.invalidateQueries({ queryKey: ['product', barcode] });
    },
  });

  const currentVote = voteData?.vote;

  return (
    <div className="max-w-2xl mx-auto">
      {onBack && (
        <button onClick={onBack} className="text-sm text-stone-500 hover:text-stone-900 mb-4">
          &larr; Ver todos los productos para este código
        </button>
      )}

      <div className="flex gap-8 items-start mb-6">
        {product.imageUrl ? (
          <img src={resolveImageUrl(product.imageUrl)} alt="" className="w-48 h-48 object-cover rounded-xl shadow-sm" />
        ) : (
          <div className="w-48 h-48 bg-stone-100 rounded-xl flex items-center justify-center text-stone-400 text-lg">
            Sin imagen
          </div>
        )}

        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-2 text-stone-900">{product.name}</h1>
          {product.brand && <p className="text-lg text-stone-500 mb-2">{product.brand}</p>}
          <p className="text-sm font-mono text-stone-400 mb-1">
            {product.barcode}
            <Link to={`/edit/${barcode}`} className="ml-3 text-xs text-emerald-600 hover:text-emerald-700 underline font-sans">
              Editar
            </Link>
          </p>
          {product.sku && <p className="text-sm text-stone-400 mb-4">SKU: {product.sku}</p>}
          {product.color && <p className="text-sm text-stone-400 mb-4">Color: {product.color}</p>}

          <div className="flex flex-wrap gap-2 mb-4">
            {product.status === 'verified' ? (
              <span className="text-xs px-3 py-1 rounded bg-emerald-100 text-emerald-700">
                Verificado
              </span>
            ) : product.status === 'flagged' ? (
              <span className="text-xs px-3 py-1 rounded bg-red-100 text-red-700">
                Reportado - en revisión
              </span>
            ) : (
              <span className="text-xs px-3 py-1 rounded bg-yellow-100 text-yellow-800">
                Pendiente
              </span>
            )}
            <span className="text-xs px-3 py-1 rounded bg-stone-100 text-stone-500">
              {product.verification_score} confirmaciones
            </span>
            {product.category && (
              <span className="text-xs px-3 py-1 rounded bg-stone-100 text-stone-500">
                {product.category.name}
              </span>
            )}
          </div>

          {product.description && (
            <p className="text-stone-600">{product.description}</p>
          )}
        </div>
      </div>

      {/* Vote buttons */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => voteMutation.mutate('confirm')}
          disabled={voteMutation.isPending}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentVote === 'confirm'
              ? 'bg-emerald-600 text-white ring-2 ring-emerald-500'
              : 'bg-stone-100 text-stone-700 hover:bg-emerald-50 hover:text-emerald-700'
          }`}
        >
          {currentVote === 'confirm' ? '✓ Confirmado' : 'Confirmar datos'}
        </button>
        <button
          onClick={() => voteMutation.mutate('flag')}
          disabled={voteMutation.isPending}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentVote === 'flag'
              ? 'bg-red-600 text-white ring-2 ring-red-500'
              : 'bg-stone-100 text-stone-700 hover:bg-red-50 hover:text-red-700'
          }`}
        >
          {currentVote === 'flag' ? '⚑ Reportado' : 'Reportar error'}
        </button>
      </div>

      {/* Variants */}
      {product.variants?.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3 text-stone-800">Variantes</h3>
          <div className="grid grid-cols-2 gap-3">
            {product.variants.map((v: any) => (
              <div key={v.id} className="bg-white border border-stone-200 rounded-lg p-3 shadow-sm">
                <p className="font-medium text-stone-900">{v.name}</p>
                {v.barcode && <p className="text-xs font-mono text-stone-400">{v.barcode}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory */}
      <InventorySection productId={product.id} />
    </div>
  );
}

function InventorySection({ productId }: { productId: string }) {
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [slug, setSlug] = useState(localStorage.getItem('biz_slug') || '');
  const [businessName, setBusinessName] = useState('');
  const [pin, setPin] = useState('');
  const [pinHint, setPinHint] = useState('');
  const [setupError, setSetupError] = useState('');
  const [existingBP, setExistingBP] = useState<any>(null);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const queryClient = useQueryClient();

  const loadBusiness = async (s: string) => {
    if (!s) return;
    setLoading(true);
    setProductsLoaded(false);
    try {
      const res = await fetch(`${API_BASE}/businesses/${s}`);
      if (res.ok) {
        const b = await res.json();
        setBusiness(b);
        localStorage.setItem('biz_slug', s);
        const bpRes = await fetch(`${API_BASE}/businesses/${s}/products`);
        if (bpRes.ok) {
          const bpList = await bpRes.json();
          const match = bpList.find((bp: any) => bp.productId === productId);
          if (match) {
            setExistingBP(match);
            setPrice(match.price);
            setCost(match.cost ?? '0');
            setStock(String(match.stock));
          }
        }
      }
    } catch {} finally {
      setLoading(false);
      setProductsLoaded(true);
    }
  };

  useEffect(() => {
    if (slug) loadBusiness(slug);
  }, []);

  const createBizMutation = useMutation({
    mutationFn: async () => {
      const s = slug.trim();
      const res = await fetch(`${API_BASE}/businesses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: s, name: businessName || s, pin: pin || undefined, pinHint: pinHint || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (b) => {
      setBusiness(b);
      localStorage.setItem('biz_slug', b.slug);
      setShowSetup(false);
      loadBusiness(b.slug);
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/businesses/${business.slug}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, price: Number(price), stock: Number(stock), cost: Number(cost) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.details || `Error ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (data) => {
      setExistingBP(data);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['business', business.slug] });
    },
  });

  if (!showForm) {
    return (
      <div className="mt-8 border-t border-stone-200 pt-6">
        <button
          onClick={() => setShowForm(true)}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white"
        >
          {!productsLoaded ? 'Inventario...' : existingBP ? 'Ver / editar inventario' : 'Agregar a mi inventario'}
        </button>
      </div>
    );
  }

  if (!business && !showSetup) {
    return (
      <div className="mt-8 border-t border-stone-200 pt-6">
        <p className="text-stone-500 text-sm mb-3">
          {loading ? 'Cargando...' : slug ? `Comercio "${slug}" no encontrado.` : 'No tenés un comercio configurado.'}
        </p>
        <button
          onClick={() => setShowSetup(true)}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white"
        >
          {slug ? 'Usar otro comercio' : 'Crear mi comercio'}
        </button>
      </div>
    );
  }

  if (showSetup) {
    return (
      <div className="mt-8 border-t border-stone-200 pt-6">
        <h3 className="text-lg font-semibold mb-4 text-stone-800">Configurar comercio</h3>
        <div className="space-y-3 max-w-md">
          <div>
            <label className="block text-sm text-stone-500 mb-1">Nombre de tu comercio</label>
            <input
              type="text" value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="Ej: Mi Almacén"
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">
              Identificador (slug)
              <span className="group relative inline-flex ml-1">
                <span className="cursor-help text-stone-400 hover:text-stone-600 text-xs border border-stone-300 rounded-full w-4 h-4 inline-flex items-center justify-center">?</span>
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-stone-800 text-white text-xs rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Identificador único de tu comercio, sin espacios, todo en minúscula. Ej: "electro-mundo"
                </span>
              </span>
            </label>
            <input
              type="text" value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="Ej: mi-almacen"
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm font-mono text-stone-900"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-500 mb-1">PIN (opcional) — protegé tu POS</label>
            <p className="text-xs text-amber-600 mb-2">⚠️ No lo olvides. No hay forma de recuperarlo si lo perdés.</p>
            <input
              type="password" value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="Ej: 1234" maxLength={4}
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm font-mono text-stone-900"
            />
          </div>
          {pin && (
            <div>
              <label className="block text-sm text-stone-500 mb-1">Pista para recordar el PIN</label>
              <input
                type="text" value={pinHint}
                onChange={e => setPinHint(e.target.value)}
                placeholder="Ej: mi año de nacimiento"
                className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900"
              />
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setShowSetup(false)}
              className="flex-1 px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm text-stone-700"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (!slug.trim()) { setSetupError('Completá el identificador'); return; }
                setSetupError('');
                createBizMutation.mutate();
              }}
              disabled={createBizMutation.isPending}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm disabled:opacity-50 text-white"
            >
              {createBizMutation.isPending ? 'Guardando...' : 'Guardar comercio'}
            </button>
          </div>
          {(setupError || createBizMutation.isError) && (
            <p className="text-xs text-red-600">{setupError || (createBizMutation.error as any)?.message}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 border-t border-stone-200 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-stone-800">
          {existingBP ? 'Editar inventario' : 'Agregar a mi inventario'}
        </h3>
        <span className="text-sm text-emerald-600 font-medium">{business?.name}</span>
      </div>
      {existingBP && (
        <p className="text-xs text-stone-500 mb-3">Este producto ya está en tu inventario. Actualizá precio y stock.</p>
      )}
      <div className="space-y-3 max-w-md">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm text-stone-500 mb-1">Precio de venta $</label>
            <input
              type="number" min="0" step="0.01" value={price}
              onChange={e => setPrice(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-stone-500 mb-1">Costo $</label>
            <input
              type="number" min="0" step="0.01" value={cost}
              onChange={e => setCost(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-stone-500 mb-1">Stock</label>
            <input
              type="number" min="0" value={stock}
              onChange={e => setStock(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSetup(true)}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm text-stone-700"
          >
            Cambiar comercio
          </button>
          <button
            onClick={() => addMutation.mutate()}
            disabled={addMutation.isPending || !price}
            className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium disabled:opacity-50 text-white"
          >
            {addMutation.isPending ? 'Guardando...' : addMutation.isSuccess ? '✓ Guardado' : (existingBP ? 'Actualizar' : 'Guardar')}
          </button>
        </div>
        {addMutation.isError && (
          <p className="text-xs text-red-600">{(addMutation.error as any)?.message || 'Error al guardar'}</p>
        )}
      </div>
    </div>
  );
}

