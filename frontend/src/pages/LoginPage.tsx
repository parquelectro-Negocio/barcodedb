import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'register' && password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name || undefined);
      }
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(
        err.message === 'email_taken' ? 'Ese email ya está registrado'
        : err.message === 'invalid_credentials' ? 'Email o contraseña incorrectos'
        : 'Error al conectar'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-lg shadow-emerald-200/50">
            B
          </div>
          <h1 className="text-2xl font-bold text-stone-900">
            {mode === 'login' ? 'Bienvenido de vuelta' : 'Crear cuenta'}
          </h1>
          <p className="text-stone-500 text-sm mt-1.5">
            {mode === 'login'
              ? 'Entrá a tu cuenta para gestionar tus productos'
              : 'Registrate para empezar a cargar productos'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Nombre</label>
              <input
                type="text" value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
            <input
              type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com" required
              className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Contraseña</label>
            <input
              type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres" required minLength={6}
              className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Confirmar contraseña</label>
              <input
                type="password" value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repetí la contraseña" required minLength={6}
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</div>
          )}

          <button type="submit" disabled={busy} className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 rounded-xl font-medium text-white shadow-md shadow-emerald-200/50 transition-all">
            {busy ? 'Un momento...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>

          <p className="text-sm text-center text-stone-500 pt-1">
            {mode === 'login' ? (
              <>¿No tenés cuenta?{' '}<button type="button" onClick={() => { setMode('register'); setError(''); }} className="text-emerald-600 font-medium hover:text-emerald-500">Registrate</button></>
            ) : (
              <>¿Ya tenés cuenta?{' '}<button type="button" onClick={() => { setMode('login'); setError(''); }} className="text-emerald-600 font-medium hover:text-emerald-500">Iniciá sesión</button></>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
