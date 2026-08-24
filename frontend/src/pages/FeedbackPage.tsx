import { useState, useEffect } from 'react';
import { API_BASE } from '../lib/config';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

type Item = {
  id: string; kind: string; message: string; contact: string;
  status: string; createdAt: string; userName: string | null; userEmail: string | null;
};

export function FeedbackPage() {
  const { user, authHeaders } = useAuth();
  const { toast } = useToast();
  const [kind, setKind] = useState<'sugerencia' | 'reclamo'>('sugerencia');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (message.trim().length < 3) { toast('Escribí tu mensaje', 'error'); return; }
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ kind, message: message.trim(), contact: contact.trim() }),
      });
      if (!res.ok) throw new Error();
      setSent(true); setMessage(''); setContact('');
      toast('¡Gracias! Tu mensaje fue enviado.', 'success');
    } catch {
      toast('No se pudo enviar. Probá de nuevo.', 'error');
    } finally {
      setSending(false);
    }
  };

  // Moderator inbox
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<'open' | 'done'>('open');
  const loadList = async (status: 'open' | 'done') => {
    if (!user?.isModerator) return;
    try {
      const res = await fetch(`${API_BASE}/feedback?status=${status}`, { headers: authHeaders() });
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ }
  };
  useEffect(() => { if (user?.isModerator) loadList(tab); /* eslint-disable-next-line */ }, [tab, user, sent]);

  const resolve = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/feedback/${id}/resolve`, { method: 'POST', headers: authHeaders() });
      if (res.ok) setItems(prev => prev.filter(i => i.id !== id));
    } catch { /* ignore */ }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-800">Reclamos y sugerencias</h1>
      <p className="text-stone-500 mt-1 mb-6 text-sm">
        ¿Algo no funciona o se te ocurre una mejora? Escribime directo — leo todos los mensajes.
      </p>

      {sent ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
          <p className="text-emerald-800 font-medium">✓ ¡Gracias! Recibí tu mensaje.</p>
          <button onClick={() => setSent(false)} className="mt-2 text-sm text-emerald-700 underline">Enviar otro</button>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex gap-2">
            {(['sugerencia', 'reclamo'] as const).map(k => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  kind === k ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {k === 'sugerencia' ? '💡 Sugerencia' : '⚠️ Reclamo'}
              </button>
            ))}
          </div>

          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={5}
            placeholder="Contame qué mejorarías, qué no funciona, o qué te gustaría que agregue…"
            className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <input
            type="text"
            value={contact}
            onChange={e => setContact(e.target.value)}
            placeholder="Cómo contactarte (opcional): WhatsApp, email…"
            className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <button
            onClick={submit}
            disabled={sending || message.trim().length < 3}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          >
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      )}

      {user?.isModerator && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-stone-800">Recibidos</h2>
            <div className="flex gap-1">
              {(['open', 'done'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    tab === t ? 'bg-emerald-600 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {t === 'open' ? 'Sin resolver' : 'Resueltos'}
                </button>
              ))}
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-stone-400 text-sm py-8 text-center">Nada por acá.</p>
          ) : (
            <div className="space-y-3">
              {items.map(it => (
                <div key={it.id} className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      it.kind === 'reclamo' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {it.kind === 'reclamo' ? 'Reclamo' : 'Sugerencia'}
                    </span>
                    <span className="text-xs text-stone-400">{new Date(it.createdAt).toLocaleString('es-AR')}</span>
                  </div>
                  <p className="text-sm text-stone-800 whitespace-pre-wrap">{it.message}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-stone-400">
                    <span>
                      {it.userName || it.userEmail || 'Anónimo'}
                      {it.contact && <> · <span className="text-stone-500">{it.contact}</span></>}
                    </span>
                    {tab === 'open' && (
                      <button onClick={() => resolve(it.id)} className="text-emerald-600 hover:text-emerald-700 font-medium">
                        Marcar resuelto
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
