import { useRegisterSW } from 'virtual:pwa-register/react';

// Shows a toast when a new build is waiting, and applies it (with a clean
// reload) on tap. Replaces the silent one-load-behind autoUpdate behaviour.
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3
                    bg-stone-900 text-white rounded-xl shadow-modal px-4 py-3 animate-slide-up
                    max-w-[calc(100%-2rem)]">
      <span className="text-sm">Hay una versión nueva de BarcodeDB.</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 rounded-lg px-3 py-1.5 transition-colors shrink-0"
      >
        Actualizar
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        className="text-stone-400 hover:text-white shrink-0"
        aria-label="Cerrar"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
