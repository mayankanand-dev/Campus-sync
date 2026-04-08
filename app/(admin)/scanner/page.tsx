"use client";

import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { CheckCircle, XCircle, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface ScanResult {
  ok: boolean;
  message: string;
  bookingId?: string;
  userName?: string;
  resourceName?: string;
  slotStart?: string;
  slotEnd?: string;
  slotDate?: string;
  action: "checkin" | "checkout";
}

function ScanFeedback({ result, onReset }: { result: ScanResult; onReset: () => void }) {
  return (
    <div className={`rounded-2xl border p-6 text-center animate-fade-in ${result.ok ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
      {result.ok
        ? <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
        : <XCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
      }

      <h2 className={`text-lg font-bold mb-1 ${result.ok ? "text-green-800" : "text-red-800"}`}>
        {result.message}
      </h2>

      {result.ok && result.userName && (
        <div className="mt-3 space-y-1 text-sm text-left bg-white rounded-xl p-4 border">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Student</span>
            <span className="font-semibold">{result.userName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Resource</span>
            <span className="font-medium">{result.resourceName}</span>
          </div>
          {result.slotDate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span>{result.slotDate}</span>
            </div>
          )}
          {result.slotStart && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slot</span>
              <span>{result.slotStart?.slice(0, 5)} – {result.slotEnd?.slice(0, 5)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Action</span>
            <span className={`font-semibold ${result.action === "checkin" ? "text-green-700" : "text-blue-700"}`}>
              {result.action === "checkin" ? "✅ Checked In" : "🏁 Checked Out"}
            </span>
          </div>
        </div>
      )}

      <Button className="mt-4 w-full" onClick={onReset}>
        <Camera className="w-4 h-4 mr-2" /> Scan Next
      </Button>
    </div>
  );
}

export default function AdminScannerPage() {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(true);
  const [mode, setMode] = useState<"checkin" | "checkout">("checkin");

  function startScanner() {
    setResult(null);
    setScanning(true);
  }

  useEffect(() => {
    if (!scanning) return;

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 260, height: 260 } },
      false
    );

    scanner.render(
      async (text) => {
        await scanner.clear();
        setScanning(false);

        let token = text;
        // Try parsing as JSON (from BookingQR)
        try {
          const parsed = JSON.parse(text);
          token = parsed.token ?? text;
        } catch {
          // raw token
        }

        try {
          if (mode === "checkin") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase as any).rpc("checkin_booking", { p_qr_token: token });
            if (error) throw error;
            const row = data?.[0];
            setResult({
              ok: row?.ok ?? false,
              message: row?.message ?? "Unknown error",
              bookingId: row?.booking_id,
              userName: row?.user_name,
              resourceName: row?.resource_name,
              slotStart: row?.slot_start,
              slotEnd: row?.slot_end,
              slotDate: row?.slot_date,
              action: "checkin",
            });
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data, error } = await (supabase as any).rpc("checkout_booking", { p_qr_token: token });
            if (error) throw error;
            const row = data?.[0];
            setResult({
              ok: row?.ok ?? false,
              message: row?.message ?? "Unknown error",
              bookingId: row?.booking_id,
              action: "checkout",
            });
          }
        } catch (e: unknown) {
          setResult({
            ok: false,
            message: e instanceof Error ? e.message : "Scan failed",
            action: mode,
          });
        }
      },
      (err) => console.warn("QR scan error:", err)
    );

    scannerRef.current = scanner;
    return () => { scanner.clear().catch(() => {}); };
  }, [scanning, mode]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between px-4">
          <span className="font-bold text-primary">CampusSync — QR Scanner</span>
          <span className="text-xs text-muted-foreground">Admin</span>
        </div>
      </header>

      <div className="container px-4 py-8 max-w-md">
        <div className="mb-6">
          <h1 className="text-xl font-bold mb-4">Scan Student QR</h1>

          {/* Mode toggle */}
          <div className="flex rounded-xl border overflow-hidden">
            {(["checkin", "checkout"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === m ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
                }`}
              >
                {m === "checkin" ? "✅ Check In" : "🏁 Check Out"}
              </button>
            ))}
          </div>
        </div>

        {result ? (
          <ScanFeedback result={result} onReset={startScanner} />
        ) : (
          <div className="rounded-2xl border overflow-hidden bg-card shadow-sm">
            <div id="qr-reader" className="w-full" />
            <p className="text-center text-sm text-muted-foreground py-3">
              Point camera at student&apos;s booking QR code
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
