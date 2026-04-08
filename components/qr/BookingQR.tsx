"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface BookingQRProps {
  bookingId: string;
  qrToken: string;
  resourceName: string;
  slotDate: string;
  slotStart: string;
  slotEnd: string;
}

export function BookingQR({
  bookingId, qrToken, resourceName, slotDate, slotStart, slotEnd,
}: BookingQRProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  // QR payload: JSON-encoded so scanner can parse everything
  const payload = JSON.stringify({
    bookingId,
    token: qrToken,
    r: resourceName,
    d: slotDate,
    s: slotStart.slice(0, 5),
    e: slotEnd.slice(0, 5),
  });

  function handleDownload() {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `booking-${bookingId.slice(0, 8)}.png`;
    a.click();
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
      {/* QR card */}
      <div className="bg-white rounded-2xl shadow-lg border p-6 flex flex-col items-center gap-4 w-full">
        <div ref={canvasRef}>
          <QRCodeCanvas
            value={payload}
            size={220}
            bgColor="#ffffff"
            fgColor="#1e3a8a"
            level="H"
            includeMargin={false}
          />
        </div>

        {/* Booking summary */}
        <div className="w-full border-t pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Resource</span>
            <span className="font-medium">{resourceName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium">
              {new Date(slotDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Time</span>
            <span className="font-medium">{slotStart.slice(0, 5)} – {slotEnd.slice(0, 5)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Booking ID</span>
            <span className="font-mono text-xs">{bookingId.slice(0, 8)}…</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 w-full">
        <Button variant="outline" className="flex-1 gap-2" onClick={handleDownload}>
          <Download className="w-4 h-4" /> Save to phone
        </Button>
        <Link href="/profile" className="flex-1">
          <Button className="w-full gap-2">
            My bookings <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
