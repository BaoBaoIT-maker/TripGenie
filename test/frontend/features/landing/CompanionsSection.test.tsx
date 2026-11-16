import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CompanionsSection } from "@/features/landing/components/CompanionsSection";

describe("CompanionsSection — Collaborative Planning Showcase", () => {
  it("renders section heading and value propositions cleanly without broken layouts", () => {
    render(<CompanionsSection />);

    expect(
      screen.getByText(/Lên kế hoạch cùng bạn bè, không lo lạc trôi tin nhắn/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Hội Bạn Đồng Hành/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Phân quyền thành viên minh bạch/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Biểu quyết dân chủ theo thời gian thực/i)
    ).toBeInTheDocument();
  });

  it("allows switching roles for collaborative members", () => {
    render(<CompanionsSection />);

    const lanAnhSelect = screen.getByLabelText(/Phân quyền cho Lan Anh/i);
    expect(lanAnhSelect).toHaveValue("EDITOR");

    fireEvent.change(lanAnhSelect, { target: { value: "VIEWER" } });
    expect(lanAnhSelect).toHaveValue("VIEWER");
    expect(screen.getAllByText(/Chỉ xem lịch trình/i)).toHaveLength(2);
  });

  it("toggles voting button state smoothly in the live snippet", () => {
    render(<CompanionsSection />);

    const voteButton = screen.getByRole("button", { name: /✓ Đã chọn/i });
    expect(voteButton).toBeInTheDocument();

    fireEvent.click(voteButton);
    expect(screen.getByRole("button", { name: /Bình chọn/i })).toBeInTheDocument();
  });
});
