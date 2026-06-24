import { useEffect, useRef, useState } from 'react';

type Props = {
  onDetect: (barcode: string) => void;
  onClose: () => void;
};

export function Scanner({ onDetect, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectedRef = useRef(false);
  const [error, setError] = useState('');
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    let quagga: any;
    let frameCount = 0;
    let rafId = 0;

    const start = async () => {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) videoRef.current.srcObject = streamRef.current;
      } catch {
        setError('No se pudo acceder a la cámara.');
        return;
      }

      const Quagga = await import('quagga');

      // Try native BarcodeDetector first
      if ('BarcodeDetector' in window) {
        const bd = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf', 'qr_code'] });
        setDetecting(true);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const video = videoRef.current!;

        const detect = async () => {
          if (detectedRef.current) return;
          if (!video.videoWidth) { rafId = requestAnimationFrame(detect); return; }

          frameCount++;
          // Skip first 15 frames — camera needs to settle
          if (frameCount < 15) { rafId = requestAnimationFrame(detect); return; }

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);

          try {
            const codes = await bd.detect(canvas);
            for (const code of codes) {
              if (code.rawValue) {
                detectedRef.current = true;
                cleanup();
                onDetect(code.rawValue);
                return;
              }
            }
          } catch { /* frame skip */ }

          rafId = requestAnimationFrame(detect);
        };
        detect();
        return;
      }

      // Fallback: Quagga
      quagga = Quagga;
      Quagga.default.init({
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: videoRef.current?.parentElement!,
          constraints: { facingMode: 'environment' },
        },
        decoder: {
          readers: ['ean_reader', 'ean_8_reader', 'code_128_reader', 'code_39_reader', 'upc_reader', 'i2of5_reader'],
        },
      }, (err: any) => {
        if (err) { setError('Error al iniciar escáner.'); return; }
        Quagga.default.start();
        setDetecting(true);
      });

      Quagga.default.onDetected((data: any) => {
        if (detectedRef.current) return;
        const code = data?.codeResult?.code;
        if (code) {
          detectedRef.current = true;
          cleanup();
          onDetect(code);
        }
      });
    };

    const cleanup = () => {
      cancelAnimationFrame(rafId);
      if (quagga) quagga.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };

    start();

    return cleanup;
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-64 border-2 border-emerald-400 rounded-xl opacity-70" />
        </div>
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <p className="text-red-400 text-lg">{error}</p>
          </div>
        )}
        {!detecting && !error && (
          <p className="absolute bottom-24 text-slate-400 text-sm">Iniciando cámara...</p>
        )}
      </div>
      <div className="p-6 flex justify-center">
        <button
          onClick={onClose}
          className="px-8 py-3 bg-slate-800 rounded-xl text-white text-lg font-medium"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
