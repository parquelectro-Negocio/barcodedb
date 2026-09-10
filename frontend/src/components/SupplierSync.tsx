import { useState } from 'react';
import { API_BASE } from '../lib/config';
import { apiHeaders } from '../lib/user';

// Moderator-only trigger for a supplier catalog sync (ELIT, INVID, ...). The
// backend endpoint is resumable (a call processes a few pages and returns
// nextOffset/done), so the full sync loops here, accumulating a running report.
// Never handles credentials — supplier tokens live only in the backend env.

interface SyncReport {
  fetched: number;
  inserted: number;
  updated: number;
  skippedNoEan: number;
  errors: number;
  total: number;
  nextOffset: number;
  done: boolean;
}

const EMPTY: SyncReport = {
  fetched: 0, inserted: 0, updated: 0, skippedNoEan: 0, errors: 0, total: 0, nextOffset: 0, done: false,
};

interface Props {
  title: string;       // e.g. "Sincronizar catálogo ELIT"
  endpoint: string;    // e.g. "/admin/sync/elit"
  note?: string;       // optional caption (e.g. rate-limit warning)
}

export function SupplierSync({ title, endpoint, note }: Props) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [report, setReport] = useState<SyncReport | null>(null);

  // Resume point: a full sync can stop mid-way (rate limit / error). We persist
  // the last processed offset per endpoint so the next run continues instead of
  // re-processing from 0 and burning the provider's request budget.
  const storageKey = `sync_offset_${endpoint}`;
  const readOffset = (): number => {
    try { return Math.max(0, parseInt(localStorage.getItem(storageKey) || '0', 10)) || 0; } catch { return 0; }
  };
  const [resumeOffset, setResumeOffset] = useState<number>(readOffset);

  async function callSync(offset: number, maxPages: number): Promise<SyncReport> {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ offset, maxPages }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.message || e.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // Safe first run: one page (~100 products) to eyeball before importing all.
  async function runTest() {
    setRunning(true); setReport(null); setMsg('Trayendo una muestra…');
    try {
      const r = await callSync(0, 1);
      setReport(r);
      setMsg(r.total ? `Prueba OK — ${r.total} productos en total.` : 'Prueba OK.');
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  }

  async function runFull() {
    setRunning(true);
    const acc: SyncReport = { ...EMPTY };
    let offset = Math.max(0, resumeOffset || 0);
    setMsg(offset > 0 ? `Reanudando desde el producto ${offset}…` : 'Sincronizando catálogo completo…');
    try {
      let done = false, guard = 0;
      while (!done && guard++ < 1000) {
        const r = await callSync(offset, 5);
        acc.fetched += r.fetched;
        acc.inserted += r.inserted;
        acc.updated += r.updated;
        acc.skippedNoEan += r.skippedNoEan;
        acc.errors += r.errors;
        acc.total = r.total;
        offset = r.nextOffset;
        done = r.done;
        try { localStorage.setItem(storageKey, String(offset)); } catch { /* ignore */ }
        setResumeOffset(offset);
        setReport({ ...acc, nextOffset: offset, done });
        setMsg(`Procesados ${acc.fetched}${r.total ? ` de ${r.total}` : ''} (posición ${offset})…`);
      }
      // Finished the whole catalog — clear the resume point.
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
      setResumeOffset(0);
      setMsg(`✓ Sincronización completa: ${acc.fetched} productos en esta corrida.`);
    } catch (e) {
      // Keep the saved offset so the next run resumes from here.
      setMsg(`Se detuvo en la posición ${offset}: ${(e as Error).message} Volvé a tocar "Sincronizar todo" y continúa desde acá.`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="card p-4 mt-5">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-sm font-semibold text-stone-700"
      >
        <span>🔄 {title}</span>
        <span className="text-stone-400">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="mt-4">
          <p className="text-xs text-stone-500 mb-3 max-w-md">
            Trae la identidad de los productos (código, nombre, marca, specs, imagen).
            Nunca importa precios ni stock. Empezá por <strong>Probar</strong> para revisar
            antes de traer todo.
          </p>
          {note && <p className="text-xs text-amber-600 mb-3 max-w-md">{note}</p>}
          <div className="flex gap-2">
            <button onClick={runTest} disabled={running} className="btn-secondary text-sm disabled:opacity-50">
              {running ? 'Trabajando…' : 'Probar (100)'}
            </button>
            <button onClick={runFull} disabled={running} className="btn-primary text-sm disabled:opacity-50">
              {running ? 'Trabajando…' : resumeOffset > 0 ? 'Continuar sincronización' : 'Sincronizar todo'}
            </button>
          </div>

          {!running && (
            <div className="flex items-center gap-2 mt-2 text-xs text-stone-500">
              <label htmlFor={`off-${endpoint}`}>Empezar desde el producto Nº</label>
              <input
                id={`off-${endpoint}`}
                type="number" min="0" step="100"
                value={resumeOffset}
                onChange={e => setResumeOffset(Math.max(0, parseInt(e.target.value || '0', 10) || 0))}
                className="input w-24 py-1"
              />
              <span className="text-stone-400">(0 = desde el principio)</span>
            </div>
          )}

          {msg && <p className="text-xs text-stone-600 mt-3">{msg}</p>}

          {report && (
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <Stat label="Nuevos" value={report.inserted} tone="emerald" />
              <Stat label="Actualizados" value={report.updated} tone="stone" />
              <Stat label="Sin EAN (salteados)" value={report.skippedNoEan} tone="amber" />
            </div>
          )}
          {report && report.errors > 0 && (
            <p className="text-xs text-red-500 mt-2">{report.errors} con error (ver logs del backend).</p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'stone' | 'amber' }) {
  const color = tone === 'emerald' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-600' : 'text-stone-700';
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-lg p-2">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-stone-400 leading-tight">{label}</p>
    </div>
  );
}
