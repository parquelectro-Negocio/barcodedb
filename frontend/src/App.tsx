import { Routes, Route, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { ProductDetail } from './pages/ProductDetail';
import { ScanPage } from './pages/ScanPage';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-emerald-400">BarcodeDB</Link>
          <div className="flex gap-4 text-sm text-slate-400">
            <Link to="/search" className="hover:text-white">Buscar</Link>
            <Link to="/scan" className="hover:text-white">Escanear</Link>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/product/:barcode" element={<ProductDetail />} />
          <Route path="/scan" element={<ScanPage />} />
        </Routes>
      </main>
    </div>
  );
}
