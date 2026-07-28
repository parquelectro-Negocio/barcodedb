import { useState } from 'react';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name || undefined);
      }
    } catch (err: any) {
      setError(err.message === 'email_taken' ? 'El email ya está registrado' : err.message === 'invalid_credentials' ? 'Email o contraseña incorrectos' : 'Error al conectar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16">
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center text-white text-lg font-bold mx-auto mb-3">B</div>
        <h1 className="text-2xl font-bold text-stone-800">
          {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </h1>
        <p className="text-stone-500 text-sm mt-1">
          {mode === 'login' ? 'Entrá a BarcodeDB para gestionar tus productos' : 'Registrate para empezar a cargar productos'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        {mode === 'register' && (
          <div>
            <label className="label">Nombre</label>
            <input type="text" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" />
          </div>
        )}
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required />
        </div>
        <div>
          <label className="label">Contraseña</label>
          <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" required minLength={6} />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
          {busy ? 'Un momento...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>

        <p className="text-sm text-center text-stone-500">
          {mode === 'login' ? (
            <>¿No tenés cuenta? <button type="button" onClick={() => setMode('register')} className="text-emerald-600 font-medium hover:underline">Registrate</button></>
          ) : (
            <>Ya tenés cuenta? <button type="button" onClick={() => setMode('login')} className="text-emerald-600 font-medium hover:underline">Iniciá sesión</button></>
          )}
        </p>
      </form>
    </div>
  );
}
