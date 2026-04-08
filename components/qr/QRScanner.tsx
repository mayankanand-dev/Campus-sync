"use client";

import { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface QRScannerProps {
  onScan: (token: string) => void;
  onError?: (error: string) => void;
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        onScan(decodedText);
        scanner.clear().catch(console.error);
      },
      (errorMessage) => {
        onError?.(errorMessage);
      }
    );

    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [onScan, onError]);

  return (
    <div className="rounded-xl overflow-hidden border bg-card">
      <div id="qr-reader" className="w-full" />
      <p className="text-xs text-muted-foreground text-center py-2">
        Point camera at the booking QR code
      </p>
    </div>
  );
}
