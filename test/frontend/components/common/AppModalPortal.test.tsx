import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppModalPortal } from "@/components/common/AppModalPortal";

describe("AppModalPortal", () => {
  it("renders accessible dialog into portal, closes on Escape/backdrop unless disableClose, and supports mobileBottomSheet", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <AppModalPortal open={false} onClose={onClose} ariaLabel="Hộp thoại thử">
        <div>Nội dung</div>
      </AppModalPortal>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(
      <AppModalPortal
        open={true}
        onClose={onClose}
        ariaLabel="Hộp thoại thử"
        mobileBottomSheet={true}
      >
        <div>Nội dung</div>
      </AppModalPortal>
    );

    const dialog = screen.getByRole("dialog", { name: "Hộp thoại thử" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.className).toContain("items-end");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <AppModalPortal open={true} onClose={onClose} ariaLabel="Đang lưu" disableClose={true}>
        <div>Đang xử lý</div>
      </AppModalPortal>
    );

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("preserves input focus when parent re-renders with an inline onClose callback", () => {
    function Harness() {
      const [open] = useState(true);
      const [text, setText] = useState("");
      return (
        <AppModalPortal open={open} onClose={() => {}} ariaLabel="Sửa tiêu đề">
          <input
            aria-label="Tên lịch trình"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </AppModalPortal>
      );
    }

    render(<Harness />);
    const input = screen.getByLabelText("Tên lịch trình");
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: "Đà Nẵng 3N2Đ" } });
    expect(document.activeElement).toBe(input);
    expect(input).toHaveValue("Đà Nẵng 3N2Đ");
  });
});
