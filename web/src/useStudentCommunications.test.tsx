import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  useStudentCommunications,
  type StudentAnnouncement,
  type StudentNotification,
  type StudentCommunicationsRequest,
} from "./useStudentCommunications";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

describe("useStudentCommunications account isolation", () => {
  it("ignores announcement and notification responses started by a previous account", async () => {
    const pending = new Map<string, Array<ReturnType<typeof deferred<unknown>>>>();
    const request = vi.fn((path: string) => {
      const next = deferred<unknown>();
      pending.set(path, [...(pending.get(path) ?? []), next]);
      return next.promise;
    }) as StudentCommunicationsRequest;
    const setError = vi.fn();
    const setBusy = vi.fn();

    const { result, rerender } = renderHook(
      ({ userId }: { userId: number }) => useStudentCommunications({
        userRole: "STUDENT", userId, activePage: "dashboard", request, setError, setBusy,
      }),
      { initialProps: { userId: 101 } },
    );

    await waitFor(() => {
      expect(pending.get("/announcements/active")).toHaveLength(1);
      expect(pending.get("/announcements")).toHaveLength(1);
      expect(pending.get("/notifications?unread=true")).toHaveLength(1);
    });

    rerender({ userId: 202 });
    await waitFor(() => {
      expect(pending.get("/announcements/active")).toHaveLength(2);
      expect(pending.get("/announcements")).toHaveLength(2);
      expect(pending.get("/notifications?unread=true")).toHaveLength(2);
    });

    const oldAnnouncement: StudentAnnouncement = {
      id: "private-old-account", title: "Old account notice", message: "Must not leak.",
      createdAt: "2026-11-11T08:00:00.000Z", publishedAt: "2026-11-11T08:00:00.000Z", expiresAt: null,
    };
    const oldNotification: StudentNotification = {
      id: "private-old-notification", kind: "EXAM_RESULT", title: "Old account result",
      message: "Must not leak.", href: "/assignments", createdAt: "2026-11-11T08:00:00.000Z",
      readAt: null, expiresAt: null,
    };

    await act(async () => {
      pending.get("/announcements/active")![0].resolve({ announcements: [oldAnnouncement] });
      pending.get("/announcements")![0].resolve({ announcements: [oldAnnouncement] });
      pending.get("/notifications?unread=true")![0].resolve({ notifications: [oldNotification] });
      await Promise.resolve();
    });

    expect(result.current.activeAnnouncements).toEqual([]);
    expect(result.current.announcements).toEqual([]);
    expect(result.current.notifications).toEqual([]);

    const currentAnnouncement = { ...oldAnnouncement, id: "current-account-notice", title: "Current account notice" };
    const currentNotification = { ...oldNotification, id: "current-account-notification", title: "Current account result" };
    await act(async () => {
      pending.get("/announcements/active")![1].resolve({ announcements: [currentAnnouncement] });
      pending.get("/announcements")![1].resolve({ announcements: [currentAnnouncement] });
      pending.get("/notifications?unread=true")![1].resolve({ notifications: [currentNotification] });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.activeAnnouncements.map((item) => item.id)).toEqual(["current-account-notice"]);
      expect(result.current.announcements.map((item) => item.id)).toEqual(["current-account-notice"]);
      expect(result.current.notifications.map((item) => item.id)).toEqual(["current-account-notification"]);
    });
    expect(setError).not.toHaveBeenCalled();
  });
});
