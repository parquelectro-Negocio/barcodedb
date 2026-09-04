import { useState } from 'react';
import { API_BASE } from '../lib/config';
import { apiHeaders } from '../lib/user';

// Moderator-only trigger for the ELIT catalog sync. The backend endpoint is
// resumable (one call processes a few pages and returns nextOffset/done), so the
// full sync loops here, accumulating a running report. Never handles credentials —
// the ELIT token lives only in the backend environment.

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

export function ElitSync() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [report, setReport] = useState<SyncReport | null>(null);

  async function callSync(offset: number, maxPages: number): Promise<SyncReport> {
    const res = await fetch(`${API_BASE}/admin/sync/elit`, {
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

  // Safe first run: pull only the first 100 products so we can eyeball the result
  // before importing the whole catalog.
  async function runTest() {
    setRunning(true); setReport(null); setMsg('Trayendo 100 productos de prueba…');
    try {
      const r = await callSync(0, 1);
      setReport(r);
      setMsg(`Prueba OK — ELIT tiene ${r.total} productos en total.`);
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setRunning(false);
    }
  }

  async function runFull() {
    setRunning(true); setMsg('Sincronizando catálogo completo…');
    const acc: SyncReport = { ...EMPTY };
    try {
      let offset = 0, done = false, guard = 0;
      while (!done && guard++ < 500) {
        const r = await callSync(offset, 5);
        acc.fetched += r.fetched;
        acc.inserted += r.inserted;
        acc.updated += r.updated;
        acc.skippedNoEan += r.skippedNoEan;
        acc.errors += r.errors;
        acc.total = r.total;
        offset = r.nextOffset;
        done = r.done;
        setReport({ ...acc, nextOffset: offset, done });
        setMsg(`Procesados ${acc.fetched} de ${r.total}…`);
      }
      setMsg(`✓ Sincronización completa: ${acc.fetched} productos procesados.`);
    } catch (e) {
      setMsg(`Se detuvo: ${(e as Error).message}. Podés reintentar — es idempotente.`);
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
        <span>🔄 Sincronizar catálogo ELIT</span>
        <span className="text-stone-400">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="mt-4">
          <p className="text-xs text-stone-500 mb-3 max-w-md">
            Trae la identidad de los productos de ELIT (código, nombre, marca, specs, imagen).
            Nunca importa precios ni stock. Empezá por <strong>Probar</strong> para revisar antes
            de traer todo.
          </p>
          <div className="flex gap-2">
            <button onClick={runTest} disabled={running} className="btn-secondary text-sm disabled:opacity-50">
              {running ? 'Trabajando…' : 'Probar (100)'}
            </button>
            <button onClick={runFull} disabled={running} className="btn-primary text-sm disabled:opacity-50">
              {running ? 'Trabajando…' : 'Sincronizar todo'}
            </button>
          </div>

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
