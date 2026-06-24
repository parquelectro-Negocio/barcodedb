import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function Home() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-4">BarcodeDB</h1>
        <p className="text-slate-400 text-lg">
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
            className="w-full px-5 py-4 bg-slate-900 border border-slate-700 rounded-xl text-lg
                       focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                       placeholder:text-slate-600"
            autoFocus
          />
        </div>
      </form>

      <div className="flex gap-3 text-sm text-slate-500">
        <span>Buscá por marca</span>
        <span>•</span>
        <span>Código de barras</span>
        <span>•</span>
        <span>Categoría</span>
      </div>
    </div>
  );
}
