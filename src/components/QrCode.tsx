import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 200, alt }: { value: string; size?: number; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => setSrc(null));
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!src) {
    return <div className="rounded-lg bg-muted" style={{ width: size, height: size }} />;
  }
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="rounded-lg bg-foreground p-2"
    />
  );
}
