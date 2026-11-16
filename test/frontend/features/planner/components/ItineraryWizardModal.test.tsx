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
    getTravelAreas: vi.fn().mockResolvedValue([]),
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
      data: null,
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

  it('renders modal with initial destination, duration and title', () => {
    renderComponent({ initialDestination: 'Đà Lạt' });

    expect(screen.getByRole('heading', { name: /Lên kế hoạch chuyến đi/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Đà Lạt')).toBeInTheDocument();
    expect(screen.getByDisplayValue('TP. Hồ Chí Minh')).toBeInTheDocument();
    expect(screen.getByText(/3 ngày 2 đêm/i)).toBeInTheDocument();
  });

  it('swaps origin and destination when clicking the swap button', async () => {
    const user = userEvent.setup();
    renderComponent({ initialDestination: 'Hà Nội' });

    const swapBtn = screen.getByRole('button', { name: /Đổi chiều điểm đi \/ điểm đến/i });
    await user.click(swapBtn);

    expect(screen.getByDisplayValue('Hà Nội')).toBeInTheDocument();
    expect(screen.getByDisplayValue('TP. Hồ Chí Minh')).toBeInTheDocument();
  });

  it('submits generation form with selected options and incremented partySize', async () => {
    const user = userEvent.setup();
    renderComponent({ initialDestination: 'Đà Nẵng' });

    await user.click(screen.getByRole('button', { name: /Tăng số người/i }));

    // Submit button
    const submitBtn = screen.getByRole('button', { name: /Tạo lịch trình/i });
    expect(submitBtn).toBeInTheDocument();
    await user.click(submitBtn);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        originCity: 'TP. Hồ Chí Minh',
        destinationCity: 'Đà Nẵng',
        transitMode: 'FLIGHT',
        intracityMode: 'MOTORBIKE_RENTAL',
        budgetLevel: 'MEDIUM',
        partySize: 2,
      }),
      expect.any(Object)
    );
  });
});
