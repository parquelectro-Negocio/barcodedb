import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export function Home() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4 text-stone-800">BarcodeDB</h1>
          <p className="text-stone-500 text-lg">
            Base colaborativa de productos. Buscá por nombre, marca o código de barras.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-xl">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscá un producto (ej: Terrabusi, Samsung, 7790040929604)..."
              className="w-full px-5 py-4 bg-white border border-stone-300 rounded-xl text-lg text-stone-900
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                         placeholder:text-stone-400"
              autoFocus
            />
          </div>
        </form>
      </div>

      {/* Guía rápida */}
      <div className="mt-8 grid gap-4 text-sm">
        <details className="bg-white border border-stone-200 rounded-xl p-4 open:ring-2 open:ring-emerald-500/30 shadow-sm">
          <summary className="font-semibold text-emerald-600 cursor-pointer select-none">
            📖 ¿Cómo usar BarcodeDB?
          </summary>
          <div className="mt-3 space-y-3 text-stone-600">
            <div>
              <p className="font-medium text-stone-800 mb-1">🔍 1. Buscar un producto</p>
              <p className="text-stone-500">Escribí el nombre, la marca o el código de barras en la barra de búsqueda. Si el código no está registrado, te va a dar la opción de <Link to="/add" className="text-emerald-600 underline">agregarlo</Link>.</p>
            </div>
            <div>
              <p className="font-medium text-stone-800 mb-1">📸 2. Escanear con la cámara</p>
              <p className="text-stone-500">Andá a <Link to="/scan" className="text-emerald-600 underline">Escanear</Link> y apuntá la cámara al código de barras. Te lleva directo al producto.</p>
            </div>
            <div>
              <p className="font-medium text-stone-800 mb-1">➕ 3. Agregar un producto nuevo</p>
              <p className="text-stone-500">Si un producto no existe, toca <Link to="/add" className="text-emerald-600 underline">Agregar producto</Link>. Completá nombre, marca, SKU, categoría y una foto (formato jpg, png, webp o gif).</p>
            </div>
            <div>
              <p className="font-medium text-stone-800 mb-1">💰 4. Armar tu inventario</p>
              <p className="text-stone-500">Cuando ves un producto, podés ponerle tu precio y stock para tener tu catálogo personal. Después usalo en <Link to="/pos" className="text-emerald-600 underline">Vender</Link>.</p>
            </div>
            <div>
              <p className="font-medium text-stone-800 mb-1">📦 5. Importar desde Excel</p>
              <p className="text-stone-500">Andá a <Link to="/import" className="text-emerald-600 underline">Importar</Link> y subí un archivo con tu lista de productos. El sistema busca coincidencias automáticamente.</p>
            </div>
          </div>
        </details>

        <div className="flex flex-wrap gap-3 justify-center text-sm text-stone-400">
          <span>Buscá por marca</span>
          <span>•</span>
          <span>Código de barras</span>
          <span>•</span>
          <span>Categoría</span>
          <span>•</span>
          <span><Link to="/add" className="px-3 py-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">Agregar producto</Link></span>
          <span>•</span>
          <span><Link to="/import" className="px-3 py-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">Importar</Link></span>
        </div>
      </div>
    </div>
  );
}
