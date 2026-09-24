import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, RefreshCw, ArrowRight, Keyboard } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';

interface BarcodeScannerProps {
  isOpen?: boolean;
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ isOpen = true, onScan, onClose }) => {
  const [error, setError] = useState<string>('');
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>('');
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const stopScannerSafe = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {
        // Ignore cleanup errors
      } finally {
        scannerRef.current = null;
      }
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (!isOpen) return;
    
    setError('');
    setIsPermissionDenied(false);
    setIsStarting(true);

    await stopScannerSafe();

    // Check mediaDevices support
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError('Camera is not supported in this browser or iframe environment. Please enter the barcode manually.');
      setIsStarting(false);
      return;
    }

    try {
      const readerElement = document.getElementById('barcode-reader-container');
      if (!readerElement) {
        setIsStarting(false);
        return;
      }

      const scanner = new Html5Qrcode('barcode-reader-container');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 160 },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          if (!isMountedRef.current) return;
          try {
            await stopScannerSafe();
          } catch (e) {
            // Ignore
          }
          onScan(decodedText.trim());
        },
        () => {
          // Continuous scan frame without match is normal, do nothing
        }
      );
    } catch (err: any) {
      if (!isMountedRef.current) return;
      
      const errMsg = err?.toString() || '';
      const isDenied = 
        errMsg.includes('NotAllowedError') || 
        errMsg.includes('Permission denied') || 
        err?.name === 'NotAllowedError';

      if (isDenied) {
        setIsPermissionDenied(true);
        setError('Camera permission was denied. Please allow camera access in your browser settings or use manual entry below.');
      } else {
        setError('Could not start camera scanner. Please verify your camera is connected or enter the barcode manually.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsStarting(false);
      }
    }
  }, [isOpen, onScan, stopScannerSafe]);

  useEffect(() => {
    isMountedRef.current = true;

    if (isOpen) {
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => {
        clearTimeout(timer);
        stopScannerSafe();
      };
    } else {
      stopScannerSafe();
    }

    return () => {
      isMountedRef.current = false;
      stopScannerSafe();
    };
  }, [isOpen, startScanner, stopScannerSafe]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      stopScannerSafe();
      onScan(manualCode.trim());
    }
  };

  if (isOpen === false) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <Card className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden p-0 relative">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600 font-bold">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Scan Barcode / SKU</h3>
              <p className="text-[11px] text-slate-500">Scan via camera or type manually</p>
            </div>
          </div>
          <button 
            onClick={async () => {
              await stopScannerSafe();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Camera Viewport / Error Box */}
        <div className="p-4 bg-slate-950 relative min-h-[260px] flex flex-col items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-4 text-center max-w-sm space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-white mb-1">
                  {isPermissionDenied ? 'Camera Access Denied' : 'Camera Unavailable'}
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {error}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={startScanner}
                className="h-8 px-3 text-xs bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white inline-flex items-center gap-1.5 mx-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Camera</span>
              </Button>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <div id="barcode-reader-container" className="w-full max-w-[320px] rounded-lg overflow-hidden" />
              {isStarting && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-slate-300 text-xs gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-primary-400" />
                  <span>Starting camera...</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Manual Barcode Input Fallback */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Keyboard className="w-3.5 h-3.5 text-slate-500" />
            <span>Or Enter Barcode Manually</span>
          </div>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Type or paste barcode / SKU..."
              className="flex-1 h-9 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              autoFocus={Boolean(error)}
            />
            <Button
              type="submit"
              disabled={!manualCode.trim()}
              className="h-9 px-3.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg shadow-2xs inline-flex items-center gap-1 disabled:opacity-50"
            >
              <span>Submit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 bg-white border-t border-slate-100 text-[11px] text-slate-400 text-center">
          Position the product barcode within the camera viewfinder or enter the code above.
        </div>
      </Card>
    </div>
  );
};
