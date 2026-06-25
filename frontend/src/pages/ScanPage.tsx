import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scanner } from '../components/Scanner';

export function ScanPage() {
  const [scanning, setScanning] = useState(false);
  const navigate = useNavigate();

  const handleDetect = (barcode: string) => {
    setScanning(false);
    navigate(`/product/${barcode}`);
  };

  return (
    <div className="text-center py-8">
      {!scanning ? (
        <div>
          <h2 className="text-2xl font-bold mb-4 text-stone-800">Escaneá un código de barras</h2>
          <p className="text-stone-500 mb-8">
            Usá la cámara para identificar un producto al instante
          </p>
          <button
            onClick={() => setScanning(true)}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-lg font-medium"
          >
            Abrir escáner
          </button>
        </div>
      ) : (
        <Scanner onDetect={handleDetect} onClose={() => setScanning(false)} />
      )}
    </div>
  );
}
