import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AdvisorWidget } from "@/features/advisor/components/AdvisorWidget";

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

describe("AdvisorWidget — Branded Trigger & Right Slide-over Drawer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSendMessage.mockClear();
    mockStartNewSession.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("renders branded trigger button without unsolicited popup or fake status badge", () => {
    render(<AdvisorWidget />);
    const fab = screen.getByRole("button", { name: /Mở cố vấn du lịch TripGenie/i });
    expect(fab).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByLabelText(/Gợi ý từ trợ lý ảo Genie/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Trực tuyến/i)).not.toBeInTheDocument();
  });

  it("opens right slide-over drawer when trigger button is clicked", () => {
    render(<AdvisorWidget />);

    fireEvent.click(screen.getByRole("button", { name: /Mở cố vấn du lịch TripGenie/i }));

    expect(screen.getByRole("dialog", { name: /TripGenie AI Advisor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Đóng cửa sổ tư vấn AI/i })).toBeInTheDocument();
  });

  it("opens drawer when receiving tripgenie:open-advisor custom event", () => {
    render(<AdvisorWidget />);

    act(() => {
      window.dispatchEvent(new CustomEvent("tripgenie:open-advisor"));
    });

    expect(screen.getByRole("dialog", { name: /TripGenie AI Advisor/i })).toBeInTheDocument();
  });

  it("preserves draft input text across open and close cycles", () => {
    render(<AdvisorWidget />);

    fireEvent.click(screen.getByRole("button", { name: /Mở cố vấn du lịch TripGenie/i }));

    const input = screen.getByLabelText("Nhập câu hỏi cho trợ lý du lịch") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "Tôi muốn đi Bà Nà 1 ngày" } });
    expect(input.value).toBe("Tôi muốn đi Bà Nà 1 ngày");

    fireEvent.click(screen.getByRole("button", { name: /Đóng cửa sổ tư vấn AI/i }));
    fireEvent.click(screen.getByRole("button", { name: /Mở cố vấn du lịch TripGenie/i }));

    const reopenedInput = screen.getByLabelText("Nhập câu hỏi cho trợ lý du lịch") as HTMLTextAreaElement;
    expect(reopenedInput.value).toBe("Tôi muốn đi Bà Nà 1 ngày");
  });

  it("submits message and clears draft when send button is clicked", () => {
    render(<AdvisorWidget />);

    fireEvent.click(screen.getByRole("button", { name: /Mở cố vấn du lịch TripGenie/i }));

    const input = screen.getByLabelText("Nhập câu hỏi cho trợ lý du lịch");
    fireEvent.change(input, { target: { value: "Quán ăn ngon gần Cầu Rồng" } });

    const sendBtn = screen.getByRole("button", { name: /Gửi tin nhắn/i });
    fireEvent.click(sendBtn);

    expect(mockSendMessage).toHaveBeenCalledWith("Quán ăn ngon gần Cầu Rồng");
    expect((input as HTMLTextAreaElement).value).toBe("");
  });
});
