import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import ItineraryTimeline from "@/features/planner/components/itinerary/ItineraryTimeline";
import type { ItineraryDay } from "@/types/itinerary";

const mockDays: ItineraryDay[] = [
  {
    dayNumber: 1,
    theme: "Khám phá di sản",
    activities: [
      {
        placeId: "place-1",
        placeName: "Đại Nội Huế",
        startTime: "08:30",
        endTime: "11:00",
        durationMinutes: 150,
        visitOrder: 1,
        notes: "Tham quan Hoàng thành",
        latitude: 16.469,
        longitude: 107.579,
        address: "Thành phố Huế",
        imageUrl: null,
        categoryName: "Di tích",
        distanceToNextKm: null,
      },
    ],
  },
];

describe("ItineraryTimeline authorization & read-only behavior", () => {
  it("hides edit buttons (Đổi điểm, Xóa, Thêm địa điểm) in read-only mode", () => {
    render(
      <ItineraryTimeline
        days={mockDays}
        startDate="2026-11-01"
        endDate="2026-11-03"
        onSwapPlace={undefined}
        onDeletePlace={undefined}
        onAddPlace={undefined}
        onChangeTransitMode={undefined}
      />
    );

    // Place name is rendered
    expect(screen.getByText("Đại Nội Huế")).toBeInTheDocument();

    // Editing controls MUST NOT exist in DOM
    expect(screen.queryByRole("button", { name: /Đổi điểm/i })).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Xóa điểm này khỏi lịch trình/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thêm địa điểm vào Ngày 1/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sửa phương tiện/i })).not.toBeInTheDocument();
  });

  it("renders edit buttons when user has edit permissions (canEdit mode)", () => {
    const handleSwap = vi.fn();
    const handleDelete = vi.fn();
    const handleAdd = vi.fn();

    render(
      <ItineraryTimeline
        days={mockDays}
        startDate="2026-11-01"
        endDate="2026-11-03"
        onSwapPlace={handleSwap}
        onDeletePlace={handleDelete}
        onAddPlace={handleAdd}
      />
    );

    // Editing controls MUST exist (delete lives inside overflow menu)
    expect(screen.getByRole("button", { name: /Đổi điểm/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thêm địa điểm vào Ngày 1/i })).toBeInTheDocument();

    const overflowBtn = screen.getByRole("button", { name: /Thêm tùy chọn cho Đại Nội Huế/i });
    expect(overflowBtn).toHaveAttribute("aria-haspopup", "menu");
    expect(overflowBtn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(overflowBtn);
    expect(overflowBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByTitle(/Xóa điểm này khỏi lịch trình/i)).toBeInTheDocument();
  });

  it("places Sửa giờ, Đổi điểm, Mở vote in a bottom bar below top content, isolates utility actions in ··· menu, and uses only Font Awesome icons", () => {
    const onSelectPlace = vi.fn();
    const onEditStop = vi.fn();
    const onSwapPlace = vi.fn();
    const onProposeSwap = vi.fn();
    const onMoveStop = vi.fn();
    const onDeletePlace = vi.fn();

    const editableDays: ItineraryDay[] = [
      {
        dayNumber: 1,
        theme: "Khám phá",
        activities: [
          { ...mockDays[0].activities[0], id: "stop-1" },
          { ...mockDays[0].activities[0], id: "stop-2", placeId: "place-2", placeName: "Chùa Thiên Mụ", visitOrder: 2 },
        ],
      },
    ];

    const { container } = render(
      <ItineraryTimeline
        days={editableDays}
        startDate="2026-11-01"
        endDate="2026-11-03"
        isMemberOrOwner
        onSelectPlace={onSelectPlace}
        onEditStop={onEditStop}
        onSwapPlace={onSwapPlace}
        onProposeSwap={onProposeSwap}
        onMoveStop={onMoveStop}
        onDeletePlace={onDeletePlace}
      />
    );

    const card = container.querySelector("#itinerary-activity-place-1") as HTMLElement;
    expect(card).toBeTruthy();

    const heading = card.querySelector("h3") as HTMLElement;
    const editBtn = screen.getAllByRole("button", { name: /Sửa giờ/i })[0];
    const swapBtn = screen.getAllByRole("button", { name: /Đổi điểm/i })[0];
    const voteBtn = screen.getAllByRole("button", { name: /Mở vote/i })[0];
    const overflowBtn = screen.getByRole("button", { name: /Thêm tùy chọn cho Đại Nội Huế/i });

    // Primary footer actions share the dedicated bottom action bar below title/top row
    const footer = editBtn.parentElement;
    expect(footer).toBe(swapBtn.parentElement);
    expect(footer).toBe(voteBtn.parentElement);
    expect(footer?.contains(heading)).toBe(false);
    expect(footer?.parentElement?.className).toContain("sm:pl-[98px]");

    // 100% Font Awesome icons, zero inline <svg>
    expect(card.querySelectorAll("svg")).toHaveLength(0);
    expect(card.querySelectorAll('i[class*="fa-"]').length).toBeGreaterThan(0);

    // Bottom bar actions fire with stopPropagation (must not select card)
    fireEvent.click(editBtn);
    fireEvent.click(swapBtn);
    fireEvent.click(voteBtn);

    // Open overflow menu for move/delete actions and verify Escape closes it
    fireEvent.click(overflowBtn);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    // Outside pointerdown closes menu
    fireEvent.click(overflowBtn);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    // Reopen to trigger Đẩy xuống sau and Xóa điểm dừng
    fireEvent.click(overflowBtn);
    const moveDownBtn = screen.getByRole("menuitem", { name: /Đẩy xuống sau/i });
    fireEvent.click(moveDownBtn);

    fireEvent.click(overflowBtn);
    const deleteBtn = screen.getByTitle(/Xóa điểm này khỏi lịch trình/i);
    expect(deleteBtn.parentElement).not.toBe(footer);
    fireEvent.click(deleteBtn);

    expect(onEditStop).toHaveBeenCalledTimes(1);
    expect(onSwapPlace).toHaveBeenCalledTimes(1);
    expect(onProposeSwap).toHaveBeenCalledTimes(1);
    expect(onMoveStop).toHaveBeenCalledWith("stop-1", "DOWN");
    expect(onDeletePlace).toHaveBeenCalledTimes(1);
    expect(onSelectPlace).not.toHaveBeenCalled();
  });

  it("renders concise, per-day weather card without dumping global prompt guidance", () => {
    const mockWeather = {
      destination: "Huế",
      coordinates: { lat: 16.469, lng: 107.579 },
      timezone: "Asia/Ho_Chi_Minh",
      hasForecastDays: true,
      guidance: "THỜI TIẾT TỪNG NGÀY TẠI ĐIỂM ĐẾN:\n- Ngày 1 [Dự báo]: Mưa rào\n- Ngày 2 [Dự báo]: Nắng",
      days: [
        {
          dayNumber: 1,
          date: "2026-11-01",
          source: "FORECAST" as const,
          isForecast: true,
          condition: "RAINY" as const,
          labelVi: "Mưa rào nhẹ",
          tempMinC: 22,
          tempMaxC: 27,
          tempAvgC: 25,
          precipitationProbabilityMax: 80,
          uvIndexMax: 4,
          weatherCode: 61,
        },
      ],
    };

    render(
      <ItineraryTimeline
        days={mockDays}
        startDate="2026-11-01"
        endDate="2026-11-03"
        weatherData={mockWeather}
      />
    );

    const weatherPill = screen.getByTitle("Nhấn để xem gợi ý thời tiết ngày này");
    expect(weatherPill).toBeInTheDocument();
    expect(weatherPill).toHaveAttribute("aria-expanded", "false");

    // Click to expand weather dropdown for Day 1
    fireEvent.click(weatherPill);
    expect(weatherPill).toHaveAttribute("aria-expanded", "true");

    // Should render per-day rain metric & concise advice
    expect(screen.getByText(/Mưa 80%/i)).toBeInTheDocument();
    expect(screen.getByText(/Khả năng có mưa rào/i)).toBeInTheDocument();

    // Must NEVER dump the repetitive multi-day prompt block
    expect(screen.queryByText(/THỜI TIẾT TỪNG NGÀY TẠI ĐIỂM ĐẾN/i)).not.toBeInTheDocument();

    // Clicking again collapses the card
    fireEvent.click(weatherPill);
    expect(weatherPill).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/Mưa 80%/i)).not.toBeInTheDocument();
  });
});
