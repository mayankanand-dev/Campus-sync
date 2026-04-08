"use client";

import { QRCodeSVG } from "qrcode.react";

interface QRGeneratorProps {
  value: string;
  size?: number;
}

export function QRGenerator({ value, size = 200 }: QRGeneratorProps) {
  return (
    <div className="inline-block p-4 bg-white rounded-xl shadow-inner border">
      <QRCodeSVG
        value={value}
        size={size}
        bgColor="#ffffff"
        fgColor="#1e3a8a"
        level="H"
        includeMargin={false}
      />
    </div>
  );
}
