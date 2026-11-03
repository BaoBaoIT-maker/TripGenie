import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AddPlaceToItineraryModal,
  isSameDestinationArea,
  resolveDefaultTimeSlot,
  resolvePreviewTimeSlot,
  type AddablePlace,
} from "@/features/planner/components/AddPlaceToItineraryModal";
import type { ItineraryDetail } from "@/types/itinerary";

const mockMutate = vi.fn();
const mockUseItinerariesListQuery = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/features/planner/hooks/use-itinerary-planner", () => ({
  useItinerariesListQuery: (opts?: { enabled?: boolean }) =>
    mockUseItinerariesListQuery(opts),
  useAddPlaceToItinerary: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

const samplePlace: AddablePlace = {
  id: "place-dragon-bridge",
  name: "Cầu Rồng Đà Nẵng",
  category: "sightseeing",
  city: "Đà Nẵng",
  address: "Đường Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
};

const sampleItineraries: ItineraryDetail[] = [
  {
    id: "itin-dalat",
    title: "Vi vu Đà Lạt 3N2Đ",
    description: null,
    destination: "Đà Lạt",
    startDate: "2026-12-01",
    endDate: "2026-12-03",
    totalDays: 3,
    budgetLevel: "MEDIUM",
    transitMode: "SLEEPER_BUS",
    pace: "BALANCED",
    totalEstimatedBudget: 5000000,
    budgetBreakdown: null,
    transitInfo: null,
    days: [],
  },
  {
    id: "itin-danang",
    title: "Khám phá Đà Nẵng - Hội An",
    description: null,
    destination: "Thành phố Đà Nẵng",
    startDate: "2026-12-10",
    endDate: "2026-12-11",
    totalDays: 2,
    budgetLevel: "MEDIUM",
    transitMode: "FLIGHT",
    pace: "BALANCED",
    totalEstimatedBudget: 6000000,
    budgetBreakdown: null,
    transitInfo: null,
    days: [
      {
        dayNumber: 1,
        theme: "Ngày 1: Trung tâm Đà Nẵng",
        activities: [
          {
            id: "act-1",
            placeId: "place-other",
            placeName: "Biển Mỹ Khê",
            startTime: "08:00",
            endTime: "10:00",
            durationMinutes: 120,
            visitOrder: 1,
            notes: null,
            latitude: 16.059,
            longitude: 108.245,
            address: "Đà Nẵng",
            imageUrl: null,
            categoryName: "Thiên nhiên",
            distanceToNextKm: null,
          },
        ],
      },
      {
        dayNumber: 2,
        theme: "Ngày 2: Cầu Rồng & Sơn Trà",
        activities: [
          {
            id: "act-2",
            placeId: "place-dragon-bridge",
            placeName: "Cầu Rồng Đà Nẵng",
            startTime: "20:00",
            endTime: "21:30",
            durationMinutes: 90,
            visitOrder: 1,
            notes: null,
            latitude: 16.061,
            longitude: 108.227,
            address: "Đà Nẵng",
            imageUrl: null,
            categoryName: "Điểm tham quan",
            distanceToNextKm: null,
          },
        ],
      },
    ],
  },
];

describe("AddPlaceToItineraryModal domain helpers", () => {
  it("matches destination area across accents and administrative prefixes", () => {
    expect(
      isSameDestinationArea("Thành phố Đà Nẵng", samplePlace)
    ).toBe(true);
    expect(isSameDestinationArea("Da Nang", samplePlace)).toBe(true);
    expect(isSameDestinationArea("Đà Lạt", samplePlace)).toBe(false);
  });

  it("resolves default time slot from place category", () => {
    expect(
      resolveDefaultTimeSlot({
        id: "1",
        name: "Tiệm cà phê Túi Mơ To",
        category: "cafe",
      })
    ).toBe("Sáng");

    expect(
      resolveDefaultTimeSlot({
        id: "2",
        name: "Bánh tráng cuốn thịt heo",
        category: "food",
      })
    ).toBe("Trưa");

    expect(
      resolveDefaultTimeSlot({
        id: "3",
        name: "Chợ đêm Sơn Trà",
        category: "nightlife",
      })
    ).toBe("Tối");

    expect(
      resolveDefaultTimeSlot({
        id: "4",
        name: "Bảo tàng Điêu khắc Chăm",
        category: "culture",
      })
    ).toBe("Chiều");
  });

  it("shifts preview time slot to avoid overlapping existing day activities", () => {
    const existing = [
      { startTime: "08:30", endTime: "10:00" },
      { startTime: "11:30", endTime: "13:00" },
    ];
    const resolvedMorning = resolvePreviewTimeSlot(
      { start: "08:30", end: "10:00" },
      existing
    );
    expect(resolvedMorning).toEqual({
      start: "10:15",
      end: "11:15",
      shifted: true,
    });

    const resolvedAfternoon = resolvePreviewTimeSlot(
      { start: "16:00", end: "17:30" },
      existing
    );
    expect(resolvedAfternoon).toEqual({
      start: "16:00",
      end: "17:30",
      shifted: false,
    });
  });
});

describe("AddPlaceToItineraryModal component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseItinerariesListQuery.mockReturnValue({
      data: sampleItineraries,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("auto-selects the matching-destination itinerary and submits Day + TimeSlot", async () => {
    const user = userEvent.setup();
    render(
      <AddPlaceToItineraryModal
        place={samplePlace}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Cùng điểm đến")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /thêm vào ngày 1 \(chiều\)/i })
    ).toBeEnabled();

    // Switch time slot to Sáng
    await user.click(screen.getByRole("button", { name: /buổi sáng/i }));

    const submitBtn = screen.getByRole("button", {
      name: /thêm vào ngày 1 \(sáng\)/i,
    });
    await user.click(submitBtn);

    expect(mockMutate).toHaveBeenCalledWith(
      {
        itineraryId: "itin-danang",
        dayNumber: 1,
        placeId: "place-dragon-bridge",
        placeName: "Cầu Rồng Đà Nẵng",
        timeSlot: "Sáng",
      },
      expect.any(Object)
    );
  });

  it("disables submit when place is already present in the selected day", async () => {
    const user = userEvent.setup();
    render(
      <AddPlaceToItineraryModal
        place={samplePlace}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Day 2 already contains place-dragon-bridge
    const day2Btn = screen.getByRole("button", { name: /ngày 2/i });
    await user.click(day2Btn);

    const disabledBtn = screen.getByRole("button", {
      name: /địa điểm đã có trong ngày này/i,
    });
    expect(disabledBtn).toBeDisabled();
  });
});
