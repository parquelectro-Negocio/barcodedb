import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiHeaders } from '../lib/user';
import { useToast } from '../lib/toast';
import { API_BASE } from '../lib/config';
import * as XLSX from 'xlsx';

type MatchItem = { name?: string; barcode?: string; sku?: string; brand?: string; category?: string; color?: string; capacidad?: string; largo?: string; peso?: string; cost?: number; price?: number; stock?: number };
type FileRow = Record<string, string>;

const COLUMN_KEYS = ['name', 'barcode', 'sku', 'brand', 'category', 'color', 'capacidad', 'largo', 'peso', 'cost', 'price', 'stock'] as const;
type ColumnKey = typeof COLUMN_KEYS[number];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  name: 'Nombre / Descripcion',
  barcode: 'Codigo de barras',
  sku: 'SKU / Codigo interno',
  brand: 'Marca',
  category: 'Categoria',
  color: 'Color',
  capacidad: 'Capacidad',
  largo: 'Largo',
  peso: 'Peso',
  cost: 'Costo',
  price: 'Precio',
  stock: 'Stock',
};

const COMMON_PATTERNS: Record<ColumnKey, string[]> = {
  barcode: ['codigo de barras', 'cod de barras', 'ean', 'gtin', 'barcode', 'upc', 'codigo barra'],
  sku: ['sku', 'codigo interno', 'cod interno', 'codigo articulo', 'cod articulo', 'referencia', 'ref', 'articulo', 'codigo', 'cod'],
  name: ['nombre', 'descripcion', 'producto', 'articulo', 'detalle', 'desc'],
  brand: ['marca', 'brand', 'fabricante'],
  category: ['categoria', 'category', 'rubro', 'familia', 'seccion'],
  color: ['color', 'colour'],
  capacidad: ['capacidad', 'volumen', 'capacity', 'tamaño', 'contenido'],
  largo: ['largo', 'longitud', 'length', 'medida'],
  peso: ['peso', 'weight', 'gramos', 'kg', 'kilogramo'],
  cost: ['costo', 'cost', 'compra', 'neto', 'precio compra', 'costo compra'],
  price: ['precio', 'precio venta', 'price', 'pvp', 'venta'],
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

// A supplier "section title" row (e.g. "Energía /UPS") — not a product. It has
// no barcode, no price, and a short "Sector /Subcategoría" style name.
function isHeaderRow(item: MatchItem): boolean {
  const name = (item.name ?? '').trim();
  if (!name || item.barcode || (item.price ?? 0) > 0) return false;
  return name.includes(' /') && name.split(/\s+/).length <= 5;
}

// The category a section header points to (the sector, before the first slash).
function headerCategory(name: string): string {
  return (name.split('/')[0] ?? '').trim();
}

export function ImportPage() {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [businessSlug, setBusinessSlug] = useState(localStorage.getItem('biz_slug') || '');
  const [fileRows, setFileRows] = useState<FileRow[] | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [columnMap, setColumnMap] = useState<Record<string, ColumnKey | ''>>({});
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<any>(null);
  const [editedItems, setEditedItems] = useState<Record<number, Partial<MatchItem>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setResults(null);
    setCreateResult(null);

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
    setFileRows(json);

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

  const buildItems = (): { items: MatchItem[]; skipped: number } => {
    if (fileRows && fileHeaders) {
      const mappedCols = fileHeaders.filter(h => columnMap[h]);
      const items: MatchItem[] = [];
      let skipped = 0;
      let currentCategory = '';
      let currentSection = '';
      for (const row of fileRows) {
        const item: MatchItem = {};
        for (const header of mappedCols) {
          const key = columnMap[header];
          if (!key) continue;
          const val = row[header]?.trim();
          if (!val) continue;
          if (key === 'price') item.price = parseFloat(val.replace(/[$,]/g, '')) || 0;
          else if (key === 'cost') item.cost = parseFloat(val.replace(/[$,]/g, '')) || 0;
          else if (key === 'stock') item.stock = parseInt(val) || 0;
          else item[key] = val;
        }
        // Section header: not a product. Remember its category for the rows
        // below, then skip it.
        if (isHeaderRow(item)) {
          currentCategory = headerCategory(item.name!);
          skipped++;
          continue;
        }
        // Section title (e.g. "CONSOLA DE JUEGOS"): a label in the SKU column with
        // no barcode/price. Remember it to name the code rows below, then skip it.
        if (item.sku && !item.name && !item.barcode && !(item.price && item.price > 0) && !(item.stock && item.stock > 0)) {
          currentSection = item.sku.trim();
          skipped++;
          continue;
        }
        if (!item.name && !item.barcode) continue;
        // Inherit the current section's category if the row didn't map one.
        if (!item.category && currentCategory) item.category = currentCategory;
        // Name nameless code rows with "Sección + SKU" — descriptive and unique
        // (so products under the same section don't collapse into one).
        if (!item.name) {
          const parts = [currentSection, item.sku].filter(Boolean);
          if (parts.length) item.name = parts.join(' ');
        }
        items.push(item);
      }
      return { items, skipped };
    }
    const items = text.split('\n').map(s => s.trim()).filter(Boolean).map(n => ({ name: n }));
    return { items, skipped: 0 };
  };

  const handleMatch = async () => {
    const { items, skipped } = buildItems();
    if (items.length === 0) {
      toast('No hay datos para buscar', 'error');
      return;
    }

    if (fileHeaders && fileRows) {
      const mappedCols = fileHeaders.filter(h => columnMap[h]);
      if (!mappedCols.some(h => columnMap[h] === 'name' || columnMap[h] === 'barcode')) {
        toast('Necesitas mapear al menos "Nombre" o "Codigo de barras" para buscar.', 'error');
        return;
      }
    }

    setLoading(true);
    setCreateResult(null);
    try {
      const res = await fetch(`${API_BASE}/search/match`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      setResults(data);
      setEditedItems({});
      toast(
        `Encontrados: ${data.matches.length}, Sin match: ${data.unmatched.length}` +
          (skipped > 0 ? ` · ${skipped} encabezados ignorados` : ''),
        'info',
      );
    } catch {
      toast('Error al procesar la lista', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addToBusiness = async () => {
    if (!businessSlug || !results?.matches?.length) return;
    const items: MatchItem[] = results.items ?? [];
    try {
      for (const m of results.matches) {
        const item = items[m._itemIndex] ?? {};
        await fetch(`${API_BASE}/businesses/${businessSlug}/products`, {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({
            productId: m.id,
            cost: item.cost ?? 0,
            price: item.price ?? 0,
            stock: item.stock ?? 0,
          }),
        });
      }
      toast(`Agregados ${results.matches.length} productos a "${businessSlug}"`, 'success');
    } catch {
      toast('Error al agregar productos al comercio', 'error');
    }
  };

  const createUnmatched = async () => {
    const items: MatchItem[] = results?.items ?? [];
    const unmatched = (results?.unmatched ?? []) as MatchItem[];

    const products = unmatched.map((item, i) => {
      const originalIndex = items.indexOf(item);
      const edits = editedItems[i] ?? {};
      return {
        name: (edits.name ?? item.name ?? '').trim() || (edits.sku ?? item.sku ?? '') || (edits.barcode ?? item.barcode ?? ''),
        barcode: edits.barcode ?? item.barcode ?? '',
        sku: edits.sku ?? item.sku ?? '',
        brand: edits.brand ?? item.brand ?? '',
        category: edits.category ?? item.category ?? '',
        color: edits.color ?? item.color ?? '',
        capacidad: edits.capacidad ?? item.capacidad ?? '',
        largo: edits.largo ?? item.largo ?? '',
        peso: edits.peso ?? item.peso ?? '',
        cost: edits.cost ?? item.cost ?? 0,
        price: edits.price ?? item.price ?? 0,
        stock: edits.stock ?? item.stock ?? 0,
      };
    }).filter(p => p.name.trim());

    if (products.length === 0) {
      toast('No hay productos sin nombre para crear', 'error');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/products/bulk`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          products,
          businessSlug: businessSlug || undefined,
        }),
      });
      const data = await res.json();
      setCreateResult(data);
      if (data.errors?.length > 0) {
        toast(`Creados ${data.created.length} de ${products.length}. ${data.errors.length} errores.`, data.errors.length > 0 ? 'error' : 'success');
      } else {
        toast(`Creados ${data.created.length} productos correctamente`, 'success');
      }
    } catch {
      toast('Error al crear productos', 'error');
    } finally {
      setCreating(false);
    }
  };

  const clearFile = () => {
    setFileRows(null);
    setFileHeaders(null);
    setFileName('');
    setColumnMap({});
    setResults(null);
    setCreateResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateEdit = (index: number, field: string, value: string | number) => {
    setEditedItems(prev => ({
      ...prev,
      [index]: { ...prev[index], [field]: value },
    }));
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-2 text-stone-800">Importar productos</h2>
      <p className="text-sm text-stone-500 mb-4">Subí una lista de precios en Excel o CSV. El sistema busca coincidencias y te deja crear los que falten.</p>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 mb-4 text-center cursor-pointer transition-colors
          ${fileRows ? 'border-emerald-500 bg-emerald-50' : 'border-stone-300 hover:border-stone-400 bg-white'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {fileRows ? (
          <p className="text-emerald-600">{fileName} &mdash; {fileRows.length} filas cargadas (click para cambiar)</p>
        ) : (
          <p className="text-stone-400">Solta un archivo .xlsx / .xls / .csv aca, o hace click para seleccionar</p>
        )}
      </div>

      {fileHeaders && fileRows && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Vista previa &mdash; mapea las columnas</h3>
            <button onClick={clearFile} className="text-sm text-stone-400 hover:text-stone-900">Quitar archivo</button>
          </div>

          <div className="overflow-x-auto border border-stone-200 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-100">
                  {fileHeaders.map(h => (
                    <th key={h} className="p-2 text-left font-medium text-stone-600 whitespace-nowrap">
                      <p className="mb-1">{h}</p>
                      <select
                        value={columnMap[h] ?? ''}
                        onChange={e => setColumnMap(prev => ({ ...prev, [h]: e.target.value as ColumnKey | '' }))}
                        className="w-full text-xs bg-white border border-stone-200 rounded px-1 py-1 text-stone-800"
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
                  <tr key={i} className="border-t border-stone-200">
                    {fileHeaders.map(h => (
                      <td key={h} className="p-2 text-stone-500 truncate max-w-[200px]">{row[h]}</td>
                    ))}
                  </tr>
                ))}
                {fileRows.length > 10 && (
                  <tr className="border-t border-stone-200">
                    <td colSpan={fileHeaders.length} className="p-2 text-center text-stone-400 italic">
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
          <p className="text-stone-500 mb-3">O pega una lista de productos (uno por linea):</p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={"Samsung Galaxy A16\nKingston 128GB microSD\nMouse Logitech M90\nCable HDMI 2m\n..."}
            rows={6}
            className="w-full px-4 py-3 bg-white border border-stone-300 rounded-xl text-sm text-stone-900
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
          className="flex-1 px-4 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          onClick={handleMatch}
          disabled={loading || (!text.trim() && !fileRows)}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg font-medium text-white"
        >
          {loading ? 'Procesando...' : 'Buscar coincidencias'}
        </button>
      </div>

      {results && (
        <MatchResults
          results={results}
          businessSlug={businessSlug}
          onAddToBusiness={addToBusiness}
          onCreateUnmatched={createUnmatched}
          creating={creating}
          createResult={createResult}
          editedItems={editedItems}
          onEdit={updateEdit}
        />
      )}
    </div>
  );
}

function UnmatchedItem({
  item, index, edits, onEdit,
}: {
  item: MatchItem; index: number; edits: Partial<MatchItem>; onEdit: (i: number, f: string, v: string | number) => void;
}) {
  const name = edits.name ?? item.name ?? '';
  const barcode = edits.barcode ?? item.barcode ?? '';
  const brand = edits.brand ?? item.brand ?? '';
  const color = edits.color ?? item.color ?? '';
  const capacidad = edits.capacidad ?? item.capacidad ?? '';
  const largo = edits.largo ?? item.largo ?? '';
  const peso = edits.peso ?? item.peso ?? '';
  const cost = edits.cost ?? item.cost ?? 0;
  const price = edits.price ?? item.price ?? 0;
  const stock = edits.stock ?? item.stock ?? 0;

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-3 shadow-sm">
      <div className="grid grid-cols-12 gap-2 items-center">
        <div className="col-span-2">
          <input
            type="text"
            value={name}
            onChange={e => onEdit(index, 'name', e.target.value)}
            placeholder="Nombre"
            className="w-full px-2 py-1 text-sm bg-stone-50 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="col-span-2">
          <input
            type="text"
            value={barcode}
            onChange={e => onEdit(index, 'barcode', e.target.value)}
            placeholder="Código"
            className="w-full px-2 py-1 text-xs font-mono bg-stone-50 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="col-span-1">
          <input
            type="text"
            value={brand}
            onChange={e => onEdit(index, 'brand', e.target.value)}
            placeholder="Marca"
            className="w-full px-2 py-1 text-xs bg-stone-50 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="col-span-1">
          <input
            type="text"
            value={color}
            onChange={e => onEdit(index, 'color', e.target.value)}
            placeholder="Color"
            className="w-full px-2 py-1 text-xs bg-stone-50 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="col-span-1">
          <input
            type="text"
            value={capacidad}
            onChange={e => onEdit(index, 'capacidad', e.target.value)}
            placeholder="Cap."
            className="w-full px-2 py-1 text-xs bg-stone-50 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="col-span-1">
          <input
            type="text"
            value={largo}
            onChange={e => onEdit(index, 'largo', e.target.value)}
            placeholder="Largo"
            className="w-full px-2 py-1 text-xs bg-stone-50 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="col-span-1">
          <input
            type="text"
            value={peso}
            onChange={e => onEdit(index, 'peso', e.target.value)}
            placeholder="Peso"
            className="w-full px-2 py-1 text-xs bg-stone-50 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="col-span-1">
          <input
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={e => onEdit(index, 'cost', parseFloat(e.target.value) || 0)}
            placeholder="Costo"
            className="w-full px-2 py-1 text-xs font-mono bg-stone-50 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="col-span-1">
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={e => onEdit(index, 'price', parseFloat(e.target.value) || 0)}
            placeholder="$ Venta"
            className="w-full px-2 py-1 text-xs font-mono bg-stone-50 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div className="col-span-1">
          <input
            type="number"
            min="0"
            value={stock}
            onChange={e => onEdit(index, 'stock', parseInt(e.target.value) || 0)}
            placeholder="Stock"
            className="w-full px-2 py-1 text-xs font-mono bg-stone-50 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>
    </div>
  );
}

function MatchResults({ results, businessSlug, onAddToBusiness, onCreateUnmatched, creating, createResult, editedItems, onEdit }: {
  results: any; businessSlug: string; onAddToBusiness: () => void;
  onCreateUnmatched: () => void; creating: boolean; createResult: any;
  editedItems: Record<number, Partial<MatchItem>>; onEdit: (i: number, f: string, v: string | number) => void;
}) {
  const matched = results.matches ?? [];
  const unmatched = (results.unmatched ?? []) as MatchItem[];
  const items: MatchItem[] = results.items ?? [];
  const navigate = useNavigate();
  const hasPriceOrStock = unmatched.some(u => (u.price ?? 0) > 0 || (u.stock ?? 0) > 0 || (u.cost ?? 0) > 0);

  return (
    <div className="space-y-6">
      {/* Matched */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-emerald-600">
          Encontrados ({matched.length})
        </h3>
        <div className="grid gap-2">
          {matched.map((m: any, i: number) => {
            const item = items[m._itemIndex] ?? {};
            return (
              <div key={i}
                className="flex items-center gap-3 bg-white border border-stone-200 rounded-lg p-3 shadow-sm"
              >
                <span className="text-emerald-500 text-sm shrink-0">✓</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-stone-800">{m.name}</p>
                  <p className="text-xs text-stone-400">{m.brand} &middot; {m.barcode}</p>
                  {(item.price || item.stock) && (
                    <p className="text-xs text-stone-400">
                      {item.price ? `$${Number(item.price).toFixed(2)}` : ''}{item.price && item.stock ? ' · ' : ''}{item.stock ? `${item.stock} uds.` : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => navigate(`/product/${m.slug || m.barcode}`)}
                  className="text-xs text-stone-400 hover:text-emerald-600 shrink-0"
                >
                  Ver
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unmatched */}
      {unmatched.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-yellow-700">
              No encontrados ({unmatched.length})
            </h3>
            <span className="text-xs text-stone-400">Editá los datos antes de crear</span>
          </div>

          {hasPriceOrStock && (
            <div className="text-xs text-stone-400 mb-2 grid grid-cols-12 gap-2 px-1">
              <span className="col-span-2">Nombre</span>
              <span className="col-span-2">Código barras</span>
              <span className="col-span-1">Marca</span>
              <span className="col-span-1">Color</span>
              <span className="col-span-1">Cap.</span>
              <span className="col-span-1">Largo</span>
              <span className="col-span-1">Peso</span>
              <span className="col-span-1">Costo</span>
              <span className="col-span-1">Precio</span>
              <span className="col-span-1">Stock</span>
            </div>
          )}

          <div className="grid gap-2 mb-4">
            {unmatched.map((item: any, i: number) => (
              <UnmatchedItem
                key={i}
                item={item}
                index={i}
                edits={editedItems[i] ?? {}}
                onEdit={onEdit}
              />
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCreateUnmatched}
              disabled={creating}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl font-medium text-white"
            >
              {creating ? 'Creando...' : `Crear ${unmatched.length} productos en BarcodeDB`}
            </button>
          </div>

          {createResult && (
            <div className="mt-4 bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
              <p className="text-sm font-medium text-stone-700 mb-2">
                Creados {createResult.created.length} de {createResult.total}
              </p>
              {createResult.errors?.length > 0 && (
                <div className="text-xs text-red-600 space-y-1">
                  {createResult.errors.map((e: any, i: number) => (
                    <p key={i}>Error en "{e.name}": {e.error}</p>
                  ))}
                </div>
              )}
              {createResult.created.length > 0 && (
                <button
                  onClick={() => window.location.reload()}
                  className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 underline"
                >
                  Recargar para ver los cambios
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add to business */}
      {businessSlug && matched.length > 0 && (
        <button
          onClick={onAddToBusiness}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-medium text-white"
        >
          Agregar {matched.length} productos a {businessSlug}
        </button>
      )}
    </div>
  );
}
