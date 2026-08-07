import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// Floating help button + right-side slide-out drawer with the "how to use" guide.
// Keeps the landing clean while leaving help one tap away.
export function HelpDrawer() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => localStorage.getItem('help_hidden') === '1');
  const close = () => setOpen(false);
  const dismiss = () => { setHidden(true); setOpen(false); localStorage.setItem('help_hidden', '1'); };

  // Close on Escape and lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Floating trigger (dismissable) */}
      {!hidden && (
        <div className="fixed bottom-5 right-5 z-30">
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3
                       text-white shadow-modal hover:bg-emerald-500 active:bg-emerald-700 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            aria-label="Cómo usar BarcodeDB"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline text-sm font-medium">Cómo usar</span>
          </button>
          <button
            onClick={dismiss}
            aria-label="Ocultar ayuda"
            title="Ocultar"
            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full
                       bg-stone-700 text-white shadow hover:bg-stone-900 transition-colors
                       focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Backdrop */}
      <div
        onClick={close}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300
                    ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Cómo usar BarcodeDB"
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-white shadow-modal
                    transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-stone-100 bg-white px-5 py-4">
          <h2 className="text-lg font-bold text-stone-800">Cómo usar BarcodeDB</h2>
          <button onClick={close} className="btn-ghost -mr-2" aria-label="Cerrar">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 px-5 py-5 text-sm text-stone-600">
          <div>
            <p className="font-medium text-stone-800 mb-1">1. Buscar un producto</p>
            <p>Escribí el nombre, la marca o el código de barras en la barra de búsqueda. Si el código no está registrado, te da la opción de agregarlo.</p>
          </div>
          <div>
            <p className="font-medium text-stone-800 mb-1">2. Escanear con la cámara</p>
            <p>Andá a <Link to="/scan" onClick={close} className="text-emerald-600 underline">Escanear</Link> y apuntá la cámara al código de barras. Te lleva directo al producto.</p>
          </div>
          <div>
            <p className="font-medium text-stone-800 mb-1">3. Agregar un producto nuevo</p>
            <p>Si un producto no existe, toca <Link to="/add" onClick={close} className="text-emerald-600 underline">Agregar producto</Link>. Completá nombre, marca, SKU, categoría y una foto.</p>
          </div>
          <div>
            <p className="font-medium text-stone-800 mb-1">4. Armar tu inventario</p>
            <p>Cuando ves un producto, podés ponerle tu precio y stock para tener tu catálogo personal. Después usalo en <Link to="/pos" onClick={close} className="text-emerald-600 underline">Vender</Link>.</p>
          </div>
          <div>
            <p className="font-medium text-stone-800 mb-1">5. Importar desde Excel</p>
            <p>Andá a <Link to="/import" onClick={close} className="text-emerald-600 underline">Importar</Link> y subí un archivo con tu lista de productos. El sistema busca coincidencias y crea los que falten.</p>
          </div>
        </div>
      </aside>
    </>
  );
}
