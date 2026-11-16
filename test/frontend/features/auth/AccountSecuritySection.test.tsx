import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AccountSecuritySection } from "@/features/auth/components/AccountSecuritySection";

const mockLogout = vi.fn();
const mockMutateAsync = vi.fn();

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
      authMethods: ["LOCAL", "GOOGLE"],
    },
    logout: mockLogout,
    isLoggingOut: false,
  })),
}));

vi.mock("@/features/auth/hooks/use-update-profile", () => ({
  useUpdateProfile: vi.fn(() => ({
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

describe("AccountSecuritySection — Functional Profile & Safe Logout Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders editable full name and bio inputs with preloaded user data", () => {
    render(<AccountSecuritySection />);

    const nameInput = screen.getByLabelText(/Họ và tên/i) as HTMLInputElement;
    const bioTextarea = screen.getByLabelText(/Tiểu sử/i) as HTMLTextAreaElement;

    expect(nameInput.value).toBe("Nguyễn Văn Du Lịch");
    expect(bioTextarea.value).toBe("Đam mê khám phá cảnh đẹp Việt Nam.");
  });

  it("enables save button when full name is modified and calls updateProfile", async () => {
    render(<AccountSecuritySection />);

    const nameInput = screen.getByLabelText(/Họ và tên/i);
    const saveButton = screen.getByRole("button", { name: /Lưu thay đổi/i });

    // Initially not dirty -> disabled
    expect(saveButton).toBeDisabled();

    // Modify name
    fireEvent.change(nameInput, { target: { value: "Trần Du Khách Mới" } });
    expect(saveButton).not.toBeDisabled();

    // Submit form
    fireEvent.click(saveButton);
    expect(mockMutateAsync).toHaveBeenCalledWith({
      fullName: "Trần Du Khách Mới",
      bio: "Đam mê khám phá cảnh đẹp Việt Nam.",
    });
  });

  it("renders logout button in dedicated session area at the bottom", () => {
    render(<AccountSecuritySection />);

    const logoutButton = screen.getByRole("button", { name: /Đăng xuất tài khoản/i });
    expect(logoutButton).toBeInTheDocument();

    fireEvent.click(logoutButton);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
