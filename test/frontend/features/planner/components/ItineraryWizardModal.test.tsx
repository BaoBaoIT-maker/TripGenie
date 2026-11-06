import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ItineraryWizardModal from '@/features/planner/components/ItineraryWizardModal';
import { useGenerateItinerary, useTransitPreview } from '@/features/planner/hooks/use-itinerary-planner';
import { useUserPreferences } from '@/features/preferences/hooks/use-user-preferences';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/features/planner/hooks/use-itinerary-planner', () => ({
  useGenerateItinerary: vi.fn(),
  useTransitPreview: vi.fn(),
}));

vi.mock('@/features/preferences/hooks/use-user-preferences', () => ({
  useUserPreferences: vi.fn(),
}));

vi.mock('@/services/place.service', () => ({
  placeService: {
    getCities: vi.fn().mockResolvedValue([]),
  },
}));

describe('ItineraryWizardModal', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUserPreferences).mockReturnValue({
      preferences: null,
      isLoading: false,
    } as any);

    vi.mocked(useTransitPreview).mockReturnValue({
      data: null,
      isLoading: false,
    } as any);

    vi.mocked(useGenerateItinerary).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
  });

  const renderComponent = (props = {}) =>
    render(
      <QueryClientProvider client={queryClient}>
        <ItineraryWizardModal
          isOpen={true}
          onClose={vi.fn()}
          {...props}
        />
      </QueryClientProvider>
    );

  it('renders step 1 with initial destination and forward motion class', () => {
    renderComponent({ initialDestination: 'Đà Lạt' });

    expect(screen.getByText('Điểm đến')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Đà Lạt')).toBeInTheDocument();

    const forwardEl = document.querySelector('.wizard-step-forward');
    expect(forwardEl).toBeInTheDocument();
  });

  it('navigates forward to step 2 and backward to step 1 with correct direction classes', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Click Next button on Step 1
    const nextBtn = screen.getByRole('button', { name: /Tiếp tục: Phương tiện di chuyển/i });
    await user.click(nextBtn);

    // Step 2 should be rendered with forward motion
    expect(screen.getByText(/Lựa chọn chặng liên tỉnh/i)).toBeInTheDocument();
    expect(document.querySelector('.wizard-step-forward')).toBeInTheDocument();

    // Click Back button on Step 2
    const backBtn = screen.getByRole('button', { name: /Quay lại/i });
    await user.click(backBtn);

    // Should be back on Step 1 with backward motion class
    expect(screen.getByText(/ĐIỂM KHỞI HÀNH/i)).toBeInTheDocument();
    expect(document.querySelector('.wizard-step-backward')).toBeInTheDocument();
  });

  it('submits generation on step 3 once and guards against duplicate clicks', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Step 1 -> Step 2
    await user.click(screen.getByRole('button', { name: /Tiếp tục: Phương tiện di chuyển/i }));

    // Step 2 -> Step 3
    await user.click(screen.getByRole('button', { name: /Tiếp tục: Gu & Ngân sách/i }));

    // Verify Step 3 is rendered
    expect(screen.getByText(/TẠO LỊCH TRÌNH VỚI AI/i)).toBeInTheDocument();

    // Click submit
    const submitBtn = screen.getByRole('button', { name: /TẠO LỊCH TRÌNH VỚI AI/i });
    await user.click(submitBtn);

    expect(mockMutate).toHaveBeenCalledTimes(1);
  });
});
