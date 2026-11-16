import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { ItineraryHeroHeader } from '@/features/planner/components/itinerary/ItineraryHeroHeader';
import ItineraryTimeline from '@/features/planner/components/itinerary/ItineraryTimeline';
import type { ItineraryDetail, ItineraryDay } from '@/types/itinerary';

const mockDetail: ItineraryDetail = {
  id: 'itin-typo-test',
  creatorId: 'u-1',
  title: 'Hành trình Đà Nẵng 3N2Đ Tinh hoa ẩm thực',
  description: 'Khám phá ẩm thực và cảnh sắc miền Trung.',
  destination: 'Đà Nẵng',
  startDate: '2026-11-01',
  endDate: '2026-11-03',
  coverPhoto: null,
  isPublic: true,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  isOwner: true,
  canEdit: true,
  canManageMembers: true,
  days: [
    {
      dayNumber: 1,
      theme: 'Cà phê & Ẩm thực ngõ ngách',
      activities: [
        {
          placeId: 'p-1',
          placeName: 'Cafe Da Lat',
          startTime: '08:30',
          endTime: '10:00',
          durationMinutes: 90,
          visitOrder: 1,
          latitude: 11.94,
          longitude: 108.43,
          address: 'Đà Lạt',
          categoryName: 'Cà phê',
          distanceToNextKm: null,
        },
      ],
    },
  ],
};

describe('Itinerary Detail Typography & Anti-Slop Specifications', () => {
  it('renders Hero Title with font-bold instead of font-black', () => {
    render(
      <ItineraryHeroHeader
        data={mockDetail}
        activeCoverPhoto={null}
        totalDays={3}
        totalNights={2}
        isOwner={true}
        canEdit={true}
        isMemberOrOwner={true}
        memberCount={1}
        members={[]}
        pendingProposalsCount={0}
        activeTab="itinerary"
        onSelectTab={() => {}}
        onBack={() => {}}
        onOpenCoverModal={() => {}}
        onOpenEditMetaModal={() => {}}
        onOpenCompanionsModal={() => {}}
        onOpenPrintModal={() => {}}
        onShare={() => {}}
        onClone={() => {}}
        onOpenDeleteModal={() => {}}
      />
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Hành trình Đà Nẵng 3N2Đ Tinh hoa ẩm thực');
    expect(heading.className).toContain('font-bold');
    expect(heading.className).toContain('text-slate-900');
    expect(heading.className).not.toContain('font-black');
  });

  it('renders Timeline Day Header with font-bold and Place Title with font-semibold (contrast hierarchy)', () => {
    render(
      <ItineraryTimeline
        days={mockDetail.days}
        startDate={mockDetail.startDate}
        endDate={mockDetail.endDate}
      />
    );

    // Day Header (H2)
    const dayHeading = screen.getByRole('heading', { level: 2, name: /Ngày 1: Cà phê & Ẩm thực ngõ ngách/i });
    expect(dayHeading).toBeInTheDocument();
    expect(dayHeading.className).toContain('font-bold');
    expect(dayHeading.className).not.toContain('font-extrabold');

    // Place Title
    const placeHeading = screen.getByRole('heading', { level: 3, name: 'Cafe Da Lat' });
    expect(placeHeading).toBeInTheDocument();
    expect(placeHeading.className).toContain('font-semibold');
    expect(placeHeading.className).not.toContain('font-bold');
    expect(placeHeading.className).not.toContain('font-black');
  });
});
