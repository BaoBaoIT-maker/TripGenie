import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AdvisorWidget, PROMPT_CONFIG } from "@/features/advisor/components/AdvisorWidget";

vi.mock("next/navigation", () => ({
  usePathname: () => "/explore",
}));

const mockSendMessage = vi.fn();
const mockStartNewSession = vi.fn();

vi.mock("@/features/advisor/hooks/useAdvisorChat", () => ({
  useAdvisorChat: vi.fn(() => ({
    messages: [],
    isLoading: false,
    isRestoring: false,
    sendMessage: mockSendMessage,
    startNewSession: mockStartNewSession,
  })),
}));

describe("AdvisorWidget — Proactive Prompt & Interaction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    mockSendMessage.mockClear();
    mockStartNewSession.mockClear();
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
    expect(fab).toHaveTextContent("Chat");
  });

  it("triggers proactive prompt bubble after delay timer", () => {
    render(<AdvisorWidget />);

    const promptContainer = screen.getByLabelText(/Gợi ý từ trợ lý ảo Genie/i);
    expect(promptContainer).toHaveClass("opacity-0");

    act(() => {
      vi.advanceTimersByTime(PROMPT_CONFIG.APPEAR_DELAY_MS);
    });

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

    // Drawer should now be opened as an accessible dialog with its close button
    expect(screen.getByRole("dialog", { name: /TripGenie AI Advisor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đóng cửa sổ tư vấn AI/i })).toBeInTheDocument();
  });

  it("preserves draft input text across open and close cycles", () => {
    render(<AdvisorWidget />);

    // Open via FAB
    const fab = screen.getByRole("button", { name: /Mở trợ lý du lịch AI Advisor/i });
    fireEvent.click(fab);

    // Type a draft
    const input = screen.getByLabelText("Nhập câu hỏi cho trợ lý du lịch") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "Tôi muốn đi Bà Nà 1 ngày" } });
    expect(input.value).toBe("Tôi muốn đi Bà Nà 1 ngày");

    // Close via close button in drawer
    const closeBtn = screen.getByRole("button", { name: /Đóng cửa sổ tư vấn AI/i });
    fireEvent.click(closeBtn);

    // Reopen via FAB
    const fabReopen = screen.getByRole("button", { name: /Mở trợ lý du lịch AI Advisor/i });
    fireEvent.click(fabReopen);

    // Draft should still be preserved
    const reopenedInput = screen.getByLabelText("Nhập câu hỏi cho trợ lý du lịch") as HTMLTextAreaElement;
    expect(reopenedInput.value).toBe("Tôi muốn đi Bà Nà 1 ngày");
  });

  it("submits message and clears draft when send button is clicked", () => {
    render(<AdvisorWidget />);

    // Open via FAB
    const fab = screen.getByRole("button", { name: /Mở trợ lý du lịch AI Advisor/i });
    fireEvent.click(fab);

    const input = screen.getByLabelText("Nhập câu hỏi cho trợ lý du lịch");
    fireEvent.change(input, { target: { value: "Quán ăn ngon gần Cầu Rồng" } });

    const sendBtn = screen.getByRole("button", { name: /Gửi tin nhắn/i });
    fireEvent.click(sendBtn);

    expect(mockSendMessage).toHaveBeenCalledWith("Quán ăn ngon gần Cầu Rồng");
    expect((input as HTMLTextAreaElement).value).toBe("");
  });
});
