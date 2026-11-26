import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminAccountPage from "./AdminAccountPage";
import { request } from "./apiClient";

vi.mock("./apiClient", () => ({ request: vi.fn() }));

describe("AdminAccountPage", () => {
  it("shows administrator account details first and opens settings on demand", async () => {
    vi.mocked(request).mockImplementation(async (path: string) => {
      if (path === "/auth/me") return { user: { id: 7, email: "admin@example.com", role: "ADMIN", accessStatus: "APPROVED", fullName: "Arc Admin", collegeName: "Polytechnic", collegeCode: "123", branchName: "Computer Engineering", branchCode: "CM" } } as never;
      if (path === "/auth/sessions") return { sessions: [] } as never;
      if (path === "/auth/login-history") return { events: [] } as never;
      if (path === "/auth/passkeys") return { passkeys: [] } as never;
      if (path === "/auth/2fa/status") return { authenticatorEnabled: false, recoveryCodesRemaining: 0, passkeyCount: 0 } as never;
      return {} as never;
    });
    render(<AdminAccountPage email="admin@example.com" theme="dark" onThemeChange={vi.fn()} onSignOut={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect((await screen.findAllByText("Arc Admin")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("admin@example.com").length).toBeGreaterThan(0);
    expect(screen.getByText("7")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "← Back to account" }));
    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
    await waitFor(() => expect(request).toHaveBeenCalledWith("/auth/me"));
  });
});
