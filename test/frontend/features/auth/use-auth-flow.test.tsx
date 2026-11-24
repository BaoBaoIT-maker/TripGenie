import type { ReactNode } from "react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { authService } from "@/services/auth.service";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  AUTH_TRANSITION_MESSAGES,
  consumeOAuthPopupPendingFlag,
  markOAuthPopupOpened,
  OAUTH_POPUP_CONFIG,
} from "@/features/auth/components/AuthTransitionScreen";

const replaceMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: pushMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/services/auth.service", () => ({
  authService: {
    getMe: vi.fn(),
    logout: vi.fn(),
    getGoogleAuthUrl: vi.fn(() => "http://localhost:3000/api/v1/auth/google"),
  },
}));

describe("Auth Flow: Optimistic Logout & COOP-Resilient OAuth Popup Detection", () => {
  let queryClient: QueryClient;

  const createWrapper = () =>
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  it("optimistically clears user session and navigates directly to '/' in 0ms before logout API finishes", async () => {
    queryClient.setQueryData(["auth", "me"], {
      id: "u-1",
      email: "user@tripgenie.vn",
      fullName: "Hoàng Minh",
      role: "USER",
    });

    let resolveLogout!: (v: { message: string }) => void;
    vi.mocked(authService.logout).mockImplementation(
      () =>
        new Promise((res) => {
          resolveLogout = res;
        })
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    act(() => {
      void result.current.logout();
    });

    // 0ms: before authService.logout resolves, session is cleared and router.replace('/') is called
    await waitFor(() => {
      expect(queryClient.getQueryData(["auth", "me"])).toBeNull();
      expect(replaceMock).toHaveBeenCalledWith(
        OAUTH_POPUP_CONFIG.POST_LOGOUT_REDIRECT
      );
      expect(pushMock).not.toHaveBeenCalledWith("/login");
      expect(toast.success).toHaveBeenCalledWith(
        AUTH_TRANSITION_MESSAGES.LOGOUT_SUCCESS
      );
    });

    act(() => {
      resolveLogout({ message: "Logged out" });
    });
  });

  it("detects OAuth popup reliably via localStorage pending flag even when Google COOP clears window.opener and window.name", () => {
    // Simulate Google COOP resetting window.name and window.opener
    window.name = "";

    expect(consumeOAuthPopupPendingFlag()).toBe(false);

    markOAuthPopupOpened();
    expect(
      localStorage.getItem(OAUTH_POPUP_CONFIG.PENDING_STORAGE_KEY)
    ).toBeTruthy();

    // First consumption on /auth/callback succeeds even with window.name === "" and no window.opener
    expect(consumeOAuthPopupPendingFlag()).toBe(true);

    // Marker is one-time consumed so subsequent normal visits are not treated as popups
    expect(consumeOAuthPopupPendingFlag()).toBe(false);
  });
});
