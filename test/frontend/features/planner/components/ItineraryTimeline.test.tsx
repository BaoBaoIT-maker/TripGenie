import { render, screen } from "@testing-library/react";
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

    // Editing controls MUST exist
    expect(screen.getByRole("button", { name: /Đổi điểm/i })).toBeInTheDocument();
    expect(screen.getByTitle(/Xóa điểm này khỏi lịch trình/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thêm địa điểm vào Ngày 1/i })).toBeInTheDocument();
  });
});
