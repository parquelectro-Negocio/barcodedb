import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { ProductDetail } from './pages/ProductDetail';
import { ScanPage } from './pages/ScanPage';
import { AddProduct } from './pages/AddProduct';
import { ImportPage } from './pages/ImportPage';
import { POSPage } from './pages/POSPage';
import { SalesPage } from './pages/SalesPage';
import { EditProduct } from './pages/EditProduct';
import { StockPage } from './pages/StockPage';
import { LoginPage } from './pages/LoginPage';
import { PanelPage } from './pages/PanelPage';
import { ProfilePage } from './pages/ProfilePage';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import { ToastProvider } from './lib/toast';
import { AuthProvider, useAuth } from './lib/auth';
import { resolveImageUrl } from './lib/config';
import { useState, type ReactNode } from 'react';

// Gate write pages behind a real account. Reads (search, scan, product view)
// stay public; anything that mutates the global base requires login.
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-center py-16 text-stone-400">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// The collaborative base — public / contribute (available to anyone).
const BASE_NAV = [
  { path: '/search', label: 'Buscar' },
  { path: '/scan', label: 'Escanear' },
  { path: '/import', label: 'Importar' },
];
// Your shop — private, only shown when logged in.
const SHOP_NAV = [
  { path: '/panel', label: 'Panel' },
  { path: '/sales', label: 'Ventas' },
  { path: '/stock', label: 'Stock' },
];

function NavBar() {
  const location = useLocation();
  const { user, logout, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-stone-200/80 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white text-xs font-bold group-hover:bg-emerald-500 transition-colors">
            B
          </div>
          <span className="text-lg font-bold text-stone-800">BarcodeDB</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {BASE_NAV.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
              }`}
            >
              {item.label}
            </Link>
          ))}

          {!loading && user && (
            <>
              <div className="w-px h-6 bg-stone-200 mx-2" />
              {SHOP_NAV.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to="/pos"
                className="ml-1 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                Vender
              </Link>
            </>
          )}

          <div className="w-px h-6 bg-stone-200 mx-2" />
          {!loading && (
            user ? (
              <div className="flex items-center gap-2">
                <Link to="/profile" className="flex items-center gap-2 group" title="Mi perfil">
                  {user.avatarUrl && (
                    <img src={resolveImageUrl(user.avatarUrl)} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  )}
                  <span className="text-sm text-stone-600 group-hover:text-stone-900 font-medium truncate max-w-[140px] transition-colors">{user.name || user.email}</span>
                </Link>
                <button onClick={logout} className="text-sm text-stone-400 hover:text-red-500 transition-colors" title="Cerrar sesión">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              <Link to="/login" className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">Entrar</Link>
            )
          )}
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100"
          aria-label="Menú"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-stone-200 bg-white animate-fade-in">
          <div className="px-4 py-3 space-y-1">
            {BASE_NAV.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {item.label}
              </Link>
            ))}

            {user && (
              <>
                <p className="px-3 pt-3 pb-1 text-xs font-semibold text-stone-400 uppercase tracking-wide">Mi comercio</p>
                {SHOP_NAV.map(item => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMenuOpen(false)}
                    className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item.path)
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  to="/pos"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white text-center"
                >
                  Vender
                </Link>
              </>
            )}

            <div className="pt-2 mt-2 border-t border-stone-100">
              {user ? (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2.5 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100"
                  >
                    Mi perfil
                  </Link>
                  <div className="px-3 py-2 flex items-center justify-between text-sm text-stone-500">
                    <span className="truncate mr-2">{user.name || user.email}</span>
                    <button onClick={() => { logout(); setMenuOpen(false); }} className="text-red-500 hover:text-red-600 text-xs font-medium shrink-0">Salir</button>
                  </div>
                </>
              ) : (
                <Link to="/login" onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white text-center">Entrar</Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

function AppContent() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans antialiased">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-fade-in">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/product/:barcode" element={<ProductDetail />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/add" element={<RequireAuth><AddProduct /></RequireAuth>} />
          <Route path="/import" element={<RequireAuth><ImportPage /></RequireAuth>} />
          <Route path="/pos" element={<RequireAuth><POSPage /></RequireAuth>} />
          <Route path="/sales" element={<RequireAuth><SalesPage /></RequireAuth>} />
          <Route path="/edit/:barcode" element={<RequireAuth><EditProduct /></RequireAuth>} />
          <Route path="/stock" element={<RequireAuth><StockPage /></RequireAuth>} />
          <Route path="/panel" element={<RequireAuth><PanelPage /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </main>
      <PwaUpdatePrompt />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
