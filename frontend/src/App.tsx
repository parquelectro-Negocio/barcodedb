import { Routes, Route, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { ProductDetail } from './pages/ProductDetail';
import { ScanPage } from './pages/ScanPage';
import { AddProduct } from './pages/AddProduct';
import { ImportPage } from './pages/ImportPage';
import { POSPage } from './pages/POSPage';
import { SalesPage } from './pages/SalesPage';
import { ToastProvider } from './lib/toast';

export default function App() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-stone-50 text-stone-900">
        <nav className="border-b border-stone-200 bg-white px-6 py-5">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link to="/" className="text-2xl font-bold text-emerald-600">BarcodeDB</Link>
            <div className="flex gap-3">
              <Link to="/search" className="px-4 py-2 rounded-lg text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors font-medium">Buscar</Link>
              <Link to="/scan" className="px-4 py-2 rounded-lg text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors font-medium">Escanear</Link>
              <Link to="/import" className="px-4 py-2 rounded-lg text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors font-medium">Importar</Link>
              <Link to="/sales" className="px-4 py-2 rounded-lg text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors font-medium">Ventas</Link>
              <Link to="/pos" className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors font-medium">Vender</Link>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/product/:barcode" element={<ProductDetail />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/add" element={<AddProduct />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/pos" element={<POSPage />} />
            <Route path="/sales" element={<SalesPage />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  );
}
