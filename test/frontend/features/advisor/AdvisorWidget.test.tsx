import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AdvisorWidget, PROMPT_CONFIG } from "@/features/advisor/components/AdvisorWidget";

vi.mock("next/navigation", () => ({
  usePathname: () => "/explore",
}));

vi.mock("@/features/advisor/hooks/useAdvisorChat", () => ({
  useAdvisorChat: vi.fn(() => ({
    messages: [],
    isLoading: false,
    isRestoring: false,
    sendMessage: vi.fn(),
    startNewSession: vi.fn(),
  })),
}));

describe("AdvisorWidget — Proactive Prompt & Interaction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("renders Floating Action Button with live online indicator", () => {
    render(<AdvisorWidget />);
    const fab = screen.getByRole("button", { name: /Mở trợ lý du lịch AI Advisor/i });
    expect(fab).toBeInTheDocument();
    expect(screen.getByText(/Hỏi Cố Vấn AI/i)).toBeInTheDocument();
  });

  it("triggers proactive prompt bubble after delay timer", () => {
    render(<AdvisorWidget />);

    const promptContainer = screen.getByLabelText(/Gợi ý từ trợ lý ảo Genie/i);
    // Initially prompt should be hidden
    expect(promptContainer).toHaveClass("opacity-0");

    // Advance timer past APPEAR_DELAY_MS (5s)
    act(() => {
      vi.advanceTimersByTime(PROMPT_CONFIG.APPEAR_DELAY_MS);
    });

    // Prompt container should now be visible
    expect(promptContainer).toHaveClass("opacity-100");
    expect(screen.getByText(PROMPT_CONFIG.EXPLORE_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: PROMPT_CONFIG.CTA_TEXT })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: PROMPT_CONFIG.CLOSE_LABEL })).toBeInTheDocument();
  });

  it("clicking close button dismisses prompt and saves state in sessionStorage", () => {
    render(<AdvisorWidget />);

    act(() => {
      vi.advanceTimersByTime(PROMPT_CONFIG.APPEAR_DELAY_MS);
    });

    const closeBtn = screen.getByRole("button", { name: PROMPT_CONFIG.CLOSE_LABEL });
    fireEvent.click(closeBtn);

    expect(sessionStorage.getItem(PROMPT_CONFIG.STORAGE_KEY)).toBe("true");

    const promptContainer = screen.getByLabelText(/Gợi ý từ trợ lý ảo Genie/i);
    expect(promptContainer).toHaveClass("opacity-0");
  });

  it("does not display prompt if already dismissed in sessionStorage", () => {
    sessionStorage.setItem(PROMPT_CONFIG.STORAGE_KEY, "true");

    render(<AdvisorWidget />);

    act(() => {
      vi.advanceTimersByTime(PROMPT_CONFIG.APPEAR_DELAY_MS + 2000);
    });

    const promptContainer = screen.getByLabelText(/Gợi ý từ trợ lý ảo Genie/i);
    expect(promptContainer).toHaveClass("opacity-0");
  });

  it("clicking CTA button opens chat drawer and dismisses prompt", () => {
    render(<AdvisorWidget />);

    act(() => {
      vi.advanceTimersByTime(PROMPT_CONFIG.APPEAR_DELAY_MS);
    });

    const ctaBtn = screen.getByRole("button", { name: PROMPT_CONFIG.CTA_TEXT });
    fireEvent.click(ctaBtn);

    expect(sessionStorage.getItem(PROMPT_CONFIG.STORAGE_KEY)).toBe("true");

    // Drawer should now be opened, FAB changes label to close
    expect(screen.getByRole("button", { name: /Đóng trợ lý AI Advisor/i })).toBeInTheDocument();
  });
});
