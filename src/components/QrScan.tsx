"use client";

import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";

/** Full-screen camera QR scanner. Calls onResult once with the decoded text. */
export function QrScan({
  onResult,
  onClose,
}: {
  onResult: (text: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let scanner: QrScanner | null = null;
    let done = false;

    QrScanner.hasCamera()
      .then((has) => {
        if (!has) {
          setError("No camera found — paste the address instead.");
          return;
        }
        scanner = new QrScanner(
          video,
          (result) => {
            if (done) return;
            done = true;
            onResult(result.data);
          },
          { returnDetailedScanResult: true, highlightScanRegion: true },
        );
        scanner.start().catch(() => {
          setError("Camera blocked — allow access or paste the address.");
        });
      })
      .catch(() => setError("Camera unavailable — paste the address instead."));

    return () => {
      scanner?.stop();
      scanner?.destroy();
    };
  }, [onResult]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/95 p-6">
      <p className="text-sm text-[var(--muted)]">
        Point at a wallet QR or a Beam link
      </p>
      <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-2xl border border-[var(--border)] bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" />
      </div>
      {error && (
        <p className="max-w-xs text-center text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
      <button className="btn btn-ghost" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
