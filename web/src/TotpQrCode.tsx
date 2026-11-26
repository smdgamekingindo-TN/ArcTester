import { useMemo } from "react";
import { qrcode } from "./vendor/qrcode.mjs";

export default function TotpQrCode({ value }: { value: string }) {
  const svg = useMemo(() => {
    const code = qrcode(0, "M");
    code.addData(value, "Byte");
    code.make();
    return code.createSvgTag({ cellSize: 5, margin: 4, scalable: true });
  }, [value]);

  return (
    <div
      className="totp-qr-code"
      role="img"
      aria-label="Authenticator setup QR code"
      style={{
        width: "min(100%, 280px)",
        aspectRatio: "1 / 1",
        margin: "16px auto",
        padding: 12,
        boxSizing: "border-box",
        background: "#fff",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
