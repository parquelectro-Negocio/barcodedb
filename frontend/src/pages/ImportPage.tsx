import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiHeaders } from '../lib/user';

const API = '/api';

export function ImportPage() {
  const [text, setText] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [businessSlug, setBusinessSlug] = useState('');

  const handleMatch = async () => {
    const names = text.split('\n').map(s => s.trim()).filter(Boolean);
    if (names.length === 0) return;

    setLoading(true);
    try {
      const res = await fetch(`${API}/search/match`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ names }),
      });
      const data = await res.json();
      setResults({ names, matches: data.matches, unmatched: data.unmatched });
    } catch {
      alert('Error al procesar la lista');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Importar lista de productos</h2>
      <p className="text-slate-400 mb-6">
        Pegá una lista de productos (uno por línea) y el sistema va a buscar coincidencias en la base global.
      </p>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={`Samsung Galaxy A16\nKingston 128GB microSD\nMouse Logitech M90\nCable HDMI 2m\n...`}
        rows={8}
        className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm
                   focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-mono"
      />

      <div className="flex gap-3 mt-4 mb-8">
        <input
          type="text"
          value={businessSlug}
          onChange={e => setBusinessSlug(e.target.value)}
          placeholder="Slug de tu comercio (opcional)"
          className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          onClick={handleMatch}
          disabled={loading || !text.trim()}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg font-medium"
        >
          {loading ? 'Procesando...' : 'Buscar coincidencias'}
        </button>
      </div>

      {results && <MatchResults results={results} businessSlug={businessSlug} />}
    </div>
  );
}

function MatchResults({ results, businessSlug }: { results: any; businessSlug: string }) {
  const matched = results.matches ?? [];
  const unmatched = results.unmatched ?? [];
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Matched */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-emerald-400">
          Encontrados ({matched.length})
        </h3>
        <div className="grid gap-2">
          {matched.map((m: any, i: number) => (
            <div key={i}
              className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg p-3"
            >
              <span className="text-emerald-400 text-sm">✓</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.name}</p>
                <p className="text-xs text-slate-500">{m.brand} · {m.barcode}</p>
              </div>
              <button
                onClick={() => navigate(`/product/${m.barcode}`)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Ver
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Unmatched */}
      {unmatched.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-yellow-400">
            No encontrados ({unmatched.length})
          </h3>
          <div className="grid gap-2">
            {unmatched.map((name: string, i: number) => (
              <div key={i}
                className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg p-3"
              >
                <span className="text-yellow-400 text-sm">?</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{name}</p>
                </div>
                <button
                  onClick={() => navigate(`/add?name=${encodeURIComponent(name)}`)}
                  className="text-xs px-3 py-1 bg-slate-800 hover:bg-emerald-900 rounded"
                >
                  Agregar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {businessSlug && matched.length > 0 && (
        <button
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium"
        >
          Agregar {matched.length} productos a {businessSlug}
        </button>
      )}
    </div>
  );
}
