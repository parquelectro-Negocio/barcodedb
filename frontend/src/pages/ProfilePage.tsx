import { useState, useEffect, useRef } from 'react';
import { API_BASE, resolveImageUrl, uploadImage } from '../lib/config';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

export function ProfilePage() {
  const { user, authHeaders, updateUser } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  const [business, setBusiness] = useState<any>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);

  const jsonHeaders = () => ({ ...authHeaders(), 'content-type': 'application/json' });

  useEffect(() => { setName(user?.name || ''); }, [user]);

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u?.createdAt) setMemberSince(u.createdAt); })
      .catch(() => {});
    fetch(`${API_BASE}/businesses/mine`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(list => { if (Array.isArray(list) && list.length) setBusiness(list[0]); })
      .catch(() => {});
  }, []);

  const saveName = async () => {
    setSavingName(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) { toast('No se pudo guardar el nombre', 'error'); return; }
      const u = await res.json();
      updateUser({ name: u.name });
      toast('Nombre actualizado', 'success');
    } catch { toast('Error al guardar', 'error'); }
    finally { setSavingName(false); }
  };

  const onAvatarPick = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const url = await uploadImage(file);
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify({ avatarUrl: url }),
      });
      if (!res.ok) { toast('No se pudo guardar la foto', 'error'); return; }
      const u = await res.json();
      updateUser({ avatarUrl: u.avatarUrl });
      toast('Foto actualizada', 'success');
    } catch { toast('Error al subir la foto', 'error'); }
    finally { setUploadingAvatar(false); }
  };

  const changePassword = async () => {
    if (newPw.length < 6) { toast('La nueva contraseña debe tener al menos 6 caracteres', 'error'); return; }
    if (newPw !== confirmPw) { toast('Las contraseñas nuevas no coinciden', 'error'); return; }
    setChangingPw(true);
    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST', headers: jsonHeaders(),
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error === 'invalid_current_password' ? 'La contraseña actual no es correcta' : 'No se pudo cambiar la contraseña', 'error');
        return;
      }
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      toast('Contraseña actualizada', 'success');
    } catch { toast('Error al cambiar la contraseña', 'error'); }
    finally { setChangingPw(false); }
  };

  const onLogoPick = async (file: File) => {
    if (!business) return;
    setUploadingLogo(true);
    try {
      const url = await uploadImage(file);
      const res = await fetch(`${API_BASE}/businesses/${business.slug}`, {
        method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify({ logoUrl: url }),
      });
      if (!res.ok) { toast('No se pudo guardar el logo', 'error'); return; }
      const b = await res.json();
      setBusiness(b);
      toast('Logo actualizado', 'success');
    } catch { toast('Error al subir el logo', 'error'); }
    finally { setUploadingLogo(false); }
  };

  if (!user) return null;

  const initials = (user.name || user.email).slice(0, 2).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">Mi perfil</h1>

      {/* Account */}
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-emerald-100 flex items-center justify-center text-emerald-700 text-2xl font-bold">
              {user.avatarUrl
                ? <img src={resolveImageUrl(user.avatarUrl)} alt="" className="w-full h-full object-cover" />
                : initials}
            </div>
            <button
              onClick={() => avatarInput.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-md disabled:opacity-50"
              aria-label="Cambiar foto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <input ref={avatarInput} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onAvatarPick(f); e.target.value = ''; }} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-stone-800 truncate">{user.name || 'Sin nombre'}</p>
            <p className="text-sm text-stone-500 truncate">{user.email}</p>
            {memberSince && (
              <p className="text-xs text-stone-400 mt-0.5">
                Miembro desde {new Date(memberSince).toLocaleDateString('es-AR', { year: 'numeric', month: 'long' })}
              </p>
            )}
            {uploadingAvatar && <p className="text-xs text-emerald-600 mt-0.5">Subiendo foto...</p>}
          </div>
        </div>

        <label className="label">Nombre</label>
        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Tu nombre" />
          <button onClick={saveName} disabled={savingName || name.trim() === (user.name || '')} className="btn-primary shrink-0">
            {savingName ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
        <label className="label mt-4">Email</label>
        <input value={user.email} disabled className="input bg-stone-50 text-stone-400 cursor-not-allowed" />
      </div>

      {/* Security */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-1">Seguridad</h2>
        <p className="text-sm text-stone-500 mb-4">Cambiá tu contraseña. Vas a necesitar la actual.</p>
        <label className="label">Contraseña actual</label>
        <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="input mb-3" autoComplete="current-password" />
        <label className="label">Nueva contraseña</label>
        <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="input mb-3" autoComplete="new-password" placeholder="Mínimo 6 caracteres" />
        <label className="label">Repetir nueva contraseña</label>
        <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className={`input mb-4 ${confirmPw && confirmPw !== newPw ? 'ring-2 ring-red-400' : ''}`} autoComplete="new-password" placeholder="Repetí la nueva contraseña" />
        <button onClick={changePassword} disabled={changingPw || !currentPw || !newPw || !confirmPw} className="btn-primary">
          {changingPw ? 'Cambiando...' : 'Cambiar contraseña'}
        </button>
      </div>

      {/* Business */}
      {business && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-stone-800 mb-4">Mi comercio</h2>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 flex items-center justify-center text-stone-400 shrink-0">
              {business.logoUrl
                ? <img src={resolveImageUrl(business.logoUrl)} alt="" className="w-full h-full object-cover" />
                : (
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-stone-800 truncate">{business.name}</p>
              <button onClick={() => logoInput.current?.click()} disabled={uploadingLogo} className="btn-secondary text-sm mt-2 disabled:opacity-50">
                {uploadingLogo ? 'Subiendo...' : (business.logoUrl ? 'Cambiar logo' : 'Subir logo')}
              </button>
              <input ref={logoInput} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onLogoPick(f); e.target.value = ''; }} />
            </div>
          </div>
          <p className="text-xs text-stone-400 mt-3">El logo aparece en el comprobante de venta.</p>
        </div>
      )}
    </div>
  );
}
