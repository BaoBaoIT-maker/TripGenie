import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import {
  MobileItineraryMapCarousel,
  type MobileItineraryStop,
} from '@/features/planner/components/itinerary/MobileItineraryMapCarousel';

const mockStops: MobileItineraryStop[] = [
  {
    placeId: 'stop-1',
    placeName: 'Đại Nội Huế',
    categoryLabel: 'Di tích',
    address: 'Thành phố Huế',
    imageUrl: 'https://example.com/hue.jpg',
    rating: 4.8,
    stopNumber: '1',
    stopColor: '#0194F3',
    timeSlot: '08:30 – 11:00',
    dayNumber: 1,
  },
  {
    placeId: 'stop-2',
    placeName: 'Chùa Thiên Mụ',
    categoryLabel: 'Tâm linh',
    address: 'Đồi Hà Khê, Huế',
    imageUrl: null,
    rating: 4.7,
    stopNumber: '2',
    stopColor: '#0194F3',
    timeSlot: '11:30 – 12:30',
    dayNumber: 1,
  },
];

describe('MobileItineraryMapCarousel Component', () => {
  it('renders all stops with stop numbers, titles, and time slots', () => {
    const handleSelectStop = vi.fn();
    const handleJumpToTimeline = vi.fn();

    render(
      <MobileItineraryMapCarousel
        stops={mockStops}
        selectedPlaceId="stop-1"
        onSelectStop={handleSelectStop}
        onJumpToTimeline={handleJumpToTimeline}
      />
    );

    expect(screen.getByText('Đại Nội Huế')).toBeInTheDocument();
    expect(screen.getByText('Chùa Thiên Mụ')).toBeInTheDocument();
    expect(screen.getByText('08:30 – 11:00')).toBeInTheDocument();
    expect(screen.getByText('11:30 – 12:30')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('calls onSelectStop when tapping an unselected card', () => {
    const handleSelectStop = vi.fn();
    const handleJumpToTimeline = vi.fn();

    render(
      <MobileItineraryMapCarousel
        stops={mockStops}
        selectedPlaceId="stop-1"
        onSelectStop={handleSelectStop}
        onJumpToTimeline={handleJumpToTimeline}
      />
    );

    const stop2Card = document.getElementById('mobile-itinerary-stop-stop-2');
    expect(stop2Card).toBeInTheDocument();
    if (stop2Card) {
      fireEvent.click(stop2Card);
      expect(handleSelectStop).toHaveBeenCalledWith('stop-2');
    }
  });

  it('triggers onJumpToTimeline when clicking "Lịch trình" button', () => {
    const handleSelectStop = vi.fn();
    const handleJumpToTimeline = vi.fn();

    render(
      <MobileItineraryMapCarousel
        stops={mockStops}
        selectedPlaceId="stop-1"
        onSelectStop={handleSelectStop}
        onJumpToTimeline={handleJumpToTimeline}
      />
    );

    const timelineButtons = screen.getAllByRole('button', { name: /Lịch trình/i });
    expect(timelineButtons.length).toBeGreaterThan(0);
    fireEvent.click(timelineButtons[0]);

    expect(handleJumpToTimeline).toHaveBeenCalledWith('stop-1');
  });

  it('triggers onNavigateDetail when clicking "Chi tiết" button', () => {
    const handleSelectStop = vi.fn();
    const handleJumpToTimeline = vi.fn();
    const handleNavigateDetail = vi.fn();

    render(
      <MobileItineraryMapCarousel
        stops={mockStops}
        selectedPlaceId="stop-1"
        onSelectStop={handleSelectStop}
        onJumpToTimeline={handleJumpToTimeline}
        onNavigateDetail={handleNavigateDetail}
      />
    );

    const detailButtons = screen.getAllByRole('button', { name: /Chi tiết/i });
    expect(detailButtons.length).toBeGreaterThan(0);
    fireEvent.click(detailButtons[0]);

    expect(handleNavigateDetail).toHaveBeenCalledWith('stop-1');
  });

  it('returns null when stops array is empty', () => {
    const { container } = render(
      <MobileItineraryMapCarousel
        stops={[]}
        selectedPlaceId={null}
        onSelectStop={vi.fn()}
        onJumpToTimeline={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
