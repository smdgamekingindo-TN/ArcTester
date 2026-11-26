import { describe, expect, it } from "vitest";
import { getSessionActionLabel, type SecuritySession } from "./StudentSecurityCenter";

describe("mobile security session actions", () => {
  it("keeps current-session revocation explicit and labels other devices separately", () => {
    const session = { current: true } as SecuritySession;
    expect(getSessionActionLabel(session)).toBe("Sign out this device");
    expect(getSessionActionLabel({ current: false } as SecuritySession)).toBe("Revoke session");
  });
});
