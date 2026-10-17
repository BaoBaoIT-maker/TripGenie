import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TourTemplates } from "@/features/home/components/TourTemplates";
import { TOUR_TEMPLATES, getTourDates, getTourPrompt, type TourTemplate } from "@/features/planner/config/tour-templates";

vi.mock("next/dynamic", () => ({
  default: () => ({ initialTemplate }: { initialTemplate: TourTemplate }) => <div role="status">Tạo lịch: {initialTemplate.destination}, {initialTemplate.days.length} ngày</div>,
}));

describe("Tour templates", () => {
  it("previews daily activities then opens the real wizard with the same template", async () => {
    const user = userEvent.setup();
    render(<TourTemplates />);
    await user.click(screen.getByRole("button", { name: "Xem lịch trình Hội An" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Khám phá phố cổ Hội An")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lên lịch chuyến này" }));
    expect(screen.getByRole("status")).toHaveTextContent("Tạo lịch: Hội An, 2 ngày");
  });

  it("opens the chosen tour directly without generating or saving on click", async () => {
    const user = userEvent.setup();
    render(<TourTemplates />);
    await user.click(screen.getByRole("button", { name: "Lên lịch chuyến Huế" }));
    expect(screen.getByRole("status")).toHaveTextContent("Tạo lịch: Huế, 2 ngày");
  });

  it("keeps inclusive duration over month and leap-year boundaries", () => {
    expect(getTourDates(3, new Date(2028, 1, 28, 23))).toEqual({ startDate: "2028-02-28", endDate: "2028-03-01" });
    expect(getTourDates(1, new Date(2026, 11, 31))).toEqual({ startDate: "2026-12-31", endDate: "2026-12-31" });
  });

  it("passes all daily suggestions to the generation prompt", () => {
    for (const tour of TOUR_TEMPLATES) {
      const prompt = getTourPrompt(tour);
      for (const day of tour.days) {
        for (const activity of day.activities) expect(prompt).toContain(activity);
      }
    }
  });
});
