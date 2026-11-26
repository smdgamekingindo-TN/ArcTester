import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import TotpQrCode from "./TotpQrCode";

describe("TotpQrCode", () => {
  it("renders a locally generated QR for the authenticator provisioning URI", () => {
    render(<TotpQrCode value="otpauth://totp/ArcTester:student%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=ArcTester&algorithm=SHA1&digits=6&period=30" />);
    const qr = screen.getByRole("img", { name: "Authenticator setup QR code" });
    expect(qr.querySelector("svg")).not.toBeNull();
    expect(qr.querySelector("svg")?.getAttribute("viewBox")).toBeTruthy();
    expect(qr.querySelector("svg")?.querySelectorAll("path,rect").length).toBeGreaterThan(0);
  });
});
