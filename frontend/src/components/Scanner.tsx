import { useEffect, useRef, useState } from 'react';

type Props = {
  onDetect: (barcode: string) => void;
  onClose: () => void;
};

export function Scanner({ onDetect, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const detectedRef = useRef(false);
  const [error, setError] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoom, setZoom] = useState(1);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] });
      setTorchOn(v => !v);
    } catch { /* torch unsupported on this device */ }
  };

  const applyZoom = async (v: number) => {
    const track = trackRef.current;
    if (!track) return;
    setZoom(v);
    try { await track.applyConstraints({ advanced: [{ zoom: v } as any] }); } catch { /* ignore */ }
  };

  useEffect(() => {
    let quagga: any;
    let frameCount = 0;
    let rafId = 0;

    const start = async () => {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (videoRef.current) videoRef.current.srcObject = streamRef.current;
        setDetecting(true); // camera is live — drop the "Iniciando cámara" hint

        // Nudge the camera into continuous autofocus when supported (modern
        // Android/Samsung). Small barcodes up close need constant re-focusing.
        // Also expose torch/zoom controls when the device reports them.
        try {
          const track = streamRef.current.getVideoTracks()[0];
          trackRef.current = track;
          const caps: any = track?.getCapabilities?.() ?? {};
          if (caps.focusMode?.includes('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
          }
          if (caps.torch) setHasTorch(true);
          if (caps.zoom && caps.zoom.max > caps.zoom.min) {
            setZoomRange({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 });
            setZoom(caps.zoom.min);
          }
        } catch { /* capability hints are best-effort */ }
      } catch {
        setError('No se pudo acceder a la cámara.');
        return;
      }

      const Quagga = await import('quagga');

      // Confirm a code only after reading the SAME value a few times in a row.
      // A single frame can misdecode (wrong digits); consecutive agreement filters that out.
      let lastCode = '';
      let sameCount = 0;

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
                if (code.rawValue === lastCode) sameCount++;
                else { lastCode = code.rawValue; sameCount = 1; }
                if (sameCount >= 2) {
                  detectedRef.current = true;
                  cleanup();
                  onDetect(code.rawValue);
                  return;
                }
                break; // one candidate per frame
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
        if (!code) return;
        // Quagga is noisier than the native detector — require 3 agreeing reads.
        if (code === lastCode) sameCount++;
        else { lastCode = code; sameCount = 1; }
        if (sameCount >= 3) {
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
        {hasTorch && (
          <button
            onClick={toggleTorch}
            aria-label="Linterna"
            className={`absolute top-4 right-4 w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              torchOn ? 'bg-amber-400 text-stone-900' : 'bg-black/50 text-white'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
        )}
        {!error && (
          <p className="absolute bottom-24 text-slate-300 text-sm bg-black/40 px-3 py-1.5 rounded-lg">
            {detecting ? 'Apuntá al código dentro del recuadro' : 'Iniciando cámara...'}
          </p>
        )}
      </div>
      <div className="px-6 pb-6 pt-2 space-y-4">
        {zoomRange && (
          <div className="flex items-center gap-3 max-w-sm mx-auto">
            <svg className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
            <input
              type="range"
              min={zoomRange.min}
              max={zoomRange.max}
              step={zoomRange.step}
              value={zoom}
              onChange={e => applyZoom(parseFloat(e.target.value))}
              className="flex-1 accent-emerald-500"
              aria-label="Zoom"
            />
          </div>
        )}
        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-stone-800 rounded-xl text-white text-lg font-medium"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
