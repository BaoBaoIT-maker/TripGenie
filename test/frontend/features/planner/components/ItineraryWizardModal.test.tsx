import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ItineraryWizardModal from '@/features/planner/components/ItineraryWizardModal';
import { useGenerateItinerary, useTransitPreview } from '@/features/planner/hooks/use-itinerary-planner';
import { useUserPreferences } from '@/features/preferences/hooks/use-user-preferences';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { placeService } from '@/services/place.service';

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
    queryClient.clear();
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

  it('allows editing start and end dates, clamps to max days, and ignores empty clear', () => {
    renderComponent({ initialDestination: 'Đà Nẵng' });

    const startInput = screen.getByLabelText(/Ngày bắt đầu/i) as HTMLInputElement;
    const endInput = screen.getByLabelText(/Ngày kết thúc/i) as HTMLInputElement;

    expect(startInput.type).toBe('date');
    expect(endInput.type).toBe('date');
    expect(startInput.className).not.toContain('opacity-0');
    expect(endInput.className).not.toContain('opacity-0');

    // Edit to a 5-day trip
    fireEvent.change(startInput, { target: { value: '2026-12-01' } });
    fireEvent.change(endInput, { target: { value: '2026-12-05' } });
    expect(startInput.value).toBe('2026-12-01');
    expect(endInput.value).toBe('2026-12-05');
    expect(screen.getByText(/5 ngày 4 đêm/i)).toBeInTheDocument();

    // Exceeding MAX_TRIP_DAYS (7) clamps endDate to 2026-12-07
    fireEvent.change(endInput, { target: { value: '2026-12-20' } });
    expect(endInput.value).toBe('2026-12-07');
    expect(screen.getByText(/7 ngày 6 đêm/i)).toBeInTheDocument();

    // Clearing the picker does not corrupt state into NaN
    fireEvent.change(startInput, { target: { value: '' } });
    expect(startInput.value).toBe('2026-12-01');
    expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
  });

  it('formats primaryHub badge from structured hub data and submits destinationAreaId', async () => {
    const user = userEvent.setup();
    vi.mocked(placeService.getTravelAreas).mockResolvedValueOnce([
      {
        id: 48,
        name: 'Da Nang',
        nameVi: 'Đà Nẵng',
        translations: { en: 'Da Nang', vi: 'Đà Nẵng' },
        slug: 'da-nang',
        type: 'CITY',
        bbox: { minLat: null, maxLat: null, minLng: null, maxLng: null },
        latitude: 16.0544,
        longitude: 108.2022,
        primaryHub: {
          id: 'DAD',
          name: 'Sân bay Quốc tế Đà Nẵng',
          translations: {
            en: 'Da Nang International Airport',
            vi: 'Sân bay Quốc tế Đà Nẵng',
          },
          hubType: 'AIRPORT',
        },
      },
    ]);

    renderComponent();

    const destInput = screen.getByPlaceholderText(/Điểm đến/i);
    await user.click(destInput);

    expect(await screen.findByText('Sân bay Quốc tế Đà Nẵng (DAD)')).toBeInTheDocument();

    await user.click(screen.getByText('Sân bay Quốc tế Đà Nẵng (DAD)'));
    await user.click(screen.getByRole('button', { name: /Tạo lịch trình/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationCity: 'Đà Nẵng',
        destinationAreaId: 48,
      }),
      expect.any(Object)
    );
  });
});
