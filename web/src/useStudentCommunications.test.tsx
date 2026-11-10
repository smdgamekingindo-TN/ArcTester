import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStudentCommunications } from "./useStudentCommunications";

describe("useStudentCommunications", () => {
  it("loads the active announcement popup, announcement history and unread notices", async () => {
    const request = vi.fn(async (path: string) => {
      if (path === "/announcements/active") return { announcements: [{ id: "active-1", title: "Exam update", message: "Starts at 10.", createdAt: "2026-11-10T08:00:00.000Z", publishedAt: "2026-11-10T08:00:00.000Z", expiresAt: null }] };
      if (path === "/announcements") return { announcements: [{ id: "history-1", title: "Old update", message: "Read me.", createdAt: "2026-11-10T07:00:00.000Z", publishedAt: "2026-11-10T07:00:00.000Z", expiresAt: null, seenAt: null, acknowledgedAt: null }] };
      if (path === "/notifications?unread=true") return { notifications: [{ id: "notice-1", kind: "EXAM_ASSIGNMENT", title: "New exam", message: "Assigned.", href: "/assignments", createdAt: "2026-11-10T08:30:00.000Z", readAt: null, expiresAt: null }] };
      return { notifications: [] };
    });
    const setError = vi.fn();
    const setBusy = vi.fn();
    const { result } = renderHook(() => useStudentCommunications({
      userRole: "STUDENT",
      userId: 1,
      activePage: "dashboard",
      request,
      setError,
      setBusy,
    }));

    await waitFor(() => expect(result.current.announcements).toHaveLength(1));
    expect(result.current.activeAnnouncements[0].id).toBe("active-1");
    expect(result.current.notifications[0].id).toBe("notice-1");
    expect(request).toHaveBeenCalledWith("/announcements/active");
    expect(request).toHaveBeenCalledWith("/announcements");
    expect(request).toHaveBeenCalledWith("/notifications?unread=true");
  });

  it("loads the full inbox on the notifications page and persists read/acknowledgement actions", async () => {
    const request = vi.fn(async (path: string) => {
      if (path === "/announcements/active") return { announcements: [] };
      if (path === "/notifications") return { notifications: [{ id: "notice-1", kind: "EXAM_RESULT", title: "Result", message: "Ready.", href: "/assignments/a1/result", createdAt: "2026-11-10T08:30:00.000Z", readAt: null, expiresAt: null }] };
      if (path.endsWith("/read")) return { readAt: "2026-11-10T09:00:00.000Z" };
      if (path.endsWith("/acknowledge")) return { seenAt: "2026-11-10T09:00:00.000Z", acknowledgedAt: "2026-11-10T09:00:00.000Z" };
      return { announcements: [] };
    });
    const { result } = renderHook(() => useStudentCommunications({
      userRole: "STUDENT",
      userId: 1,
      activePage: "notifications",
      request,
      setError: vi.fn(),
      setBusy: vi.fn(),
    }));

    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    expect(request).toHaveBeenCalledWith("/notifications");

    await act(async () => { await result.current.markNotificationRead("notice-1"); });
    expect(result.current.notifications[0].readAt).toBe("2026-11-10T09:00:00.000Z");

    await act(async () => { await result.current.refreshAnnouncements(); });
    await act(async () => { await result.current.acknowledgeAnnouncement("history-1"); });
    expect(request).toHaveBeenCalledWith("/announcements/history-1/acknowledge", { method: "POST" });
  });

  it("clears all student communication state when the account is no longer a student", async () => {
    const request = vi.fn(async () => ({ announcements: [] }));
    const { result, rerender } = renderHook(
      ({ role }: { role: "STUDENT" | "ADMIN" }) => useStudentCommunications({
        userRole: role,
        userId: role === "STUDENT" ? 1 : null,
        activePage: "dashboard",
        request,
        setError: vi.fn(),
        setBusy: vi.fn(),
      }),
      { initialProps: { role: "STUDENT" as const } },
    );
    await waitFor(() => expect(request).toHaveBeenCalled());
    act(() => result.current.clear());
    expect(result.current.announcements).toEqual([]);
    expect(result.current.activeAnnouncements).toEqual([]);
    expect(result.current.notifications).toEqual([]);
    rerender({ role: "ADMIN" });
    expect(result.current.notifications).toEqual([]);
  });
});
