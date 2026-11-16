import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProfilePage from "@/app/profile/page";

const mockMutateAsync = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (param: string) => (param === "tab" ? "preferences" : null),
  }),
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: "u-123",
      email: "traveler@tripgenie.vn",
      fullName: "Nguyễn Văn Du Lịch",
      avatarUrl: "https://example.com/avatar.jpg",
      bio: "Đam mê khám phá cảnh đẹp Việt Nam.",
      role: "USER",
      isVerified: true,
    },
    isLoading: false,
  })),
}));

vi.mock("@/features/preferences/hooks/use-user-preferences", () => ({
  useUserPreferences: vi.fn(() => ({
    data: {
      budgetLevel: "MEDIUM",
      travelStyle: ["CULTURE"],
      preferredCategories: ["am-thuc"],
      dietaryRestrictions: ["VEGETARIAN"],
    },
    isLoading: false,
  })),
  useUpdateUserPreferences: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ProfilePage — AI Travel Preferences with Custom Inputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders predefined chips and allows adding custom travel style", () => {
    render(<ProfilePage />);

    // Check predefined chip exists
    expect(screen.getByText("Văn hóa & Di sản")).toBeInTheDocument();

    // Input custom travel style
    const customStyleInput = screen.getByPlaceholderText(/Thêm phong cách khác/i);
    const addButtons = screen.getAllByRole("button", { name: /Thêm/i });
    const addStyleButton = addButtons[0]; // first add button is for styles

    fireEvent.change(customStyleInput, { target: { value: "Săn mây Tà Xùa" } });
    fireEvent.click(addStyleButton);

    // Custom chip should now appear in the document
    expect(screen.getByText("Săn mây Tà Xùa")).toBeInTheDocument();
  });

  it("submits preferences including custom tags on save button click", async () => {
    render(<ProfilePage />);

    // Add custom style
    const customStyleInput = screen.getByPlaceholderText(/Thêm phong cách khác/i);
    const addButtons = screen.getAllByRole("button", { name: /Thêm/i });
    fireEvent.change(customStyleInput, { target: { value: "Camping ven hồ" } });
    fireEvent.click(addButtons[0]);

    // Click Save button
    const saveButton = screen.getByRole("button", { name: /Lưu sở thích du lịch/i });
    fireEvent.click(saveButton);

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        travelStyle: expect.arrayContaining(["CULTURE", "Camping ven hồ"]),
      })
    );
  });
});
