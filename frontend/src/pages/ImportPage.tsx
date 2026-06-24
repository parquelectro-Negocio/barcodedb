import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiHeaders } from '../lib/user';
import { normalizeName } from '../lib/normalizeName';
import { useToast } from '../lib/toast';
import { API_BASE } from '../lib/config';
import * as XLSX from 'xlsx';

type MatchItem = { name?: string; barcode?: string; brand?: string; price?: number; stock?: number };
type FileRow = Record<string, string>;

const COLUMN_KEYS = ['name', 'barcode', 'brand', 'price', 'stock'] as const;
type ColumnKey = typeof COLUMN_KEYS[number];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  name: 'Nombre / Descripcion',
  barcode: 'Codigo de barras',
  brand: 'Marca',
  price: 'Precio',
  stock: 'Stock',
};

const COMMON_PATTERNS: Record<ColumnKey, string[]> = {
  barcode: ['codigo', 'codigo de barras', 'ean', 'gtin', 'barcode', 'upc'],
  name: ['nombre', 'descripcion', 'producto', 'articulo', 'detalle', 'desc'],
  brand: ['marca', 'brand', 'fabricante'],
  price: ['precio', 'precio venta', 'price', 'pvp'],
  stock: ['stock', 'cantidad', 'existencia', 'inventario', 'qty'],
};

function detectColumn(headers: string[], key: ColumnKey): string | null {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const pattern of COMMON_PATTERNS[key]) {
    const idx = lower.findIndex(h => h.includes(pattern));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

export function ImportPage() {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [businessSlug, setBusinessSlug] = useState('');
  const [fileRows, setFileRows] = useState<FileRow[] | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [columnMap, setColumnMap] = useState<Record<string, ColumnKey | ''>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setResults(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      toast('Formatos aceptados: .xlsx, .xls, .csv', 'error');
      return;
    }

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<FileRow>(ws, { defval: '' });
    if (json.length === 0) {
      toast('El archivo esta vacio o no se pudo leer.', 'error');
      return;
    }

    const headers = Object.keys(json[0]);
    setFileHeaders(headers);
    setFileRows(json.slice(0, 100));

    const autoMap: Record<string, ColumnKey | ''> = {};
    for (const header of headers) {
      for (const key of COLUMN_KEYS) {
        const detected = detectColumn([header], key);
        if (detected && !Object.values(autoMap).includes(key)) {
          autoMap[header] = key;
          break;
        }
      }
      if (!autoMap[header]) autoMap[header] = '';
    }
    setColumnMap(autoMap);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleMatch = async () => {
    let items: MatchItem[];

    if (fileRows && fileHeaders) {
      const mappedCols = fileHeaders.filter(h => columnMap[h]);
      if (!mappedCols.some(h => columnMap[h] === 'name' || columnMap[h] === 'barcode')) {
        toast('Necesitas mapear al menos "Nombre" o "Codigo de barras" para buscar.', 'error');
        return;
      }
      items = fileRows.map(row => {
        const item: MatchItem = {};
        for (const header of mappedCols) {
          const key = columnMap[header];
          if (!key) continue;
          const val = row[header]?.trim();
          if (!val) continue;
          if (key === 'price') item.price = parseFloat(val.replace(/[$,]/g, '')) || 0;
          else if (key === 'stock') item.stock = parseInt(val) || 0;
          else item[key] = val;
        }
        return item;
      }).filter(i => i.name || i.barcode);
    } else {
      const names = text.split('\n').map(s => s.trim()).filter(Boolean);
      if (names.length === 0) return;
      items = names.map(n => ({ name: n }));
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/search/match`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      setResults(data);
      toast(`Encontrados: ${data.matches.length}, Sin match: ${data.unmatched.length}`, 'info');
    } catch {
      toast('Error al procesar la lista', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addToBusiness = async () => {
    if (!businessSlug || !results?.matches?.length) return;
    const matches = results.matches;
    const items: MatchItem[] = results.items ?? [];
    try {
      for (const m of matches) {
        const item = items[m._itemIndex] ?? {};
        await fetch(`${API_BASE}/businesses/${businessSlug}/products`, {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({
            productId: m.id,
            price: item.price ?? 0,
            stock: item.stock ?? 0,
          }),
        });
      }
      toast(`Agregados ${matches.length} productos a "${businessSlug}"`, 'success');
    } catch {
      toast('Error al agregar productos al comercio', 'error');
    }
  };

  const clearFile = () => {
    setFileRows(null);
    setFileHeaders(null);
    setFileName('');
    setColumnMap({});
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">Importar productos</h2>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 mb-4 text-center cursor-pointer transition-colors
          ${fileRows ? 'border-emerald-600 bg-emerald-900/20' : 'border-slate-600 hover:border-slate-500 bg-slate-900/50'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {fileRows ? (
          <p className="text-emerald-400">{fileName} &mdash; {fileRows.length} filas cargadas (click para cambiar)</p>
        ) : (
          <p className="text-slate-400">Solta un archivo .xlsx / .xls / .csv aca, o hace click para seleccionar</p>
        )}
      </div>

      {fileHeaders && fileRows && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Vista previa &mdash; mapea las columnas</h3>
            <button onClick={clearFile} className="text-sm text-slate-400 hover:text-white">Quitar archivo</button>
          </div>

          <div className="overflow-x-auto border border-slate-700 rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800">
                  {fileHeaders.map(h => (
                    <th key={h} className="p-2 text-left font-medium text-slate-300 whitespace-nowrap">
                      <p className="mb-1">{h}</p>
                      <select
                        value={columnMap[h] ?? ''}
                        onChange={e => setColumnMap(prev => ({ ...prev, [h]: e.target.value as ColumnKey | '' }))}
                        className="w-full text-xs bg-slate-900 border border-slate-700 rounded px-1 py-1 text-slate-200"
                      >
                        <option value="">&mdash; Ignorar &mdash;</option>
                        {COLUMN_KEYS.map(k => (
                          <option key={k} value={k}>{COLUMN_LABELS[k]}</option>
                        ))}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fileRows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-t border-slate-800">
                    {fileHeaders.map(h => (
                      <td key={h} className="p-2 text-slate-400 truncate max-w-[200px]">{row[h]}</td>
                    ))}
                  </tr>
                ))}
                {fileRows.length > 10 && (
                  <tr className="border-t border-slate-800">
                    <td colSpan={fileHeaders.length} className="p-2 text-center text-slate-500 italic">
                      ... y {fileRows.length - 10} filas mas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!fileRows && (
        <>
          <p className="text-slate-400 mb-3">O pega una lista de productos (uno por linea):</p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={"Samsung Galaxy A16\nKingston 128GB microSD\nMouse Logitech M90\nCable HDMI 2m\n..."}
            rows={6}
            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm
                       focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-mono"
          />
        </>
      )}

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
          disabled={loading || (!text.trim() && !fileRows)}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg font-medium"
        >
          {loading ? 'Procesando...' : 'Buscar coincidencias'}
        </button>
      </div>

      {results && <MatchResults results={results} businessSlug={businessSlug} onAddToBusiness={addToBusiness} />}
    </div>
  );
}

function UnmatchedItem({ name, navigate }: { name: string; navigate: any }) {
  const [suggestion, setSuggestion] = useState<string | null>(null);

  useEffect(() => {
    normalizeName(name).then(r => {
      if (r.name !== name) setSuggestion(r.name);
    }).catch(() => {});
  }, [name]);

  return (
    <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg p-3">
      <span className="text-yellow-400 text-sm shrink-0">?</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        {suggestion && (
          <p className="text-xs text-emerald-500 truncate">Sugerencia: {suggestion}</p>
        )}
      </div>
      <button
        onClick={() => navigate(`/add?name=${encodeURIComponent(suggestion ?? name)}`)}
        className="text-xs px-3 py-1 bg-slate-800 hover:bg-emerald-900 rounded shrink-0"
      >
        Agregar
      </button>
    </div>
  );
}

function MatchResults({ results, businessSlug, onAddToBusiness }: {
  results: any; businessSlug: string; onAddToBusiness: () => void;
}) {
  const matched = results.matches ?? [];
  const unmatched = results.unmatched ?? [];
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3 text-emerald-400">
          Encontrados ({matched.length})
        </h3>
        <div className="grid gap-2">
          {matched.map((m: any, i: number) => (
            <div key={i}
              className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg p-3"
            >
              <span className="text-emerald-400 text-sm shrink-0">&#10003;</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.name}</p>
                <p className="text-xs text-slate-500">{m.brand} &middot; {m.barcode}</p>
              </div>
              <button
                onClick={() => navigate(`/product/${m.barcode}`)}
                className="text-xs text-slate-400 hover:text-white shrink-0"
              >
                Ver
              </button>
            </div>
          ))}
        </div>
      </div>

      {unmatched.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-yellow-400">
            No encontrados ({unmatched.length})
          </h3>
          <div className="grid gap-2">
            {unmatched.map((item: any, i: number) => {
              const name = typeof item === 'string' ? item : (item.name ?? item.barcode ?? '');
              return <UnmatchedItem key={i} name={name} navigate={navigate} />;
            })}
          </div>
        </div>
      )}

      {businessSlug && matched.length > 0 && (
        <button
          onClick={onAddToBusiness}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium"
        >
          Agregar {matched.length} productos a {businessSlug}
        </button>
      )}
    </div>
  );
}