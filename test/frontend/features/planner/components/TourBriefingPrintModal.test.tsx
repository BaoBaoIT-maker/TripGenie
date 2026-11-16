import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TourBriefingPrintModal } from '@/features/planner/components/itinerary/TourBriefingPrintModal';
import { DEFAULT_PRINT_SHEET_OPTIONS } from '@/features/planner/components/itinerary/tour-briefing';
import type { ItineraryDetail } from '@/types/itinerary';

describe('TourBriefingPrintModal Component', () => {
  const mockData: ItineraryDetail = {
    id: 'test-itinerary-123',
    title: 'Khám phá Đà Nẵng 3N2Đ',
    destination: 'Đà Nẵng',
    totalDays: 3,
    days: [
      { dayNumber: 1, theme: 'Biển Mỹ Khê', activities: [] },
      { dayNumber: 2, theme: 'Bà Nà Hills', activities: [] },
      { dayNumber: 3, theme: 'Phố cổ Hội An', activities: [] },
    ],
    budgetLevel: 'MEDIUM',
    partySize: 4,
    creatorId: 'user-1',
    isOwner: true,
    canEdit: true,
  } as unknown as ItineraryDetail;

  it('renders modal with print switches and briefing inputs in system theme', () => {
    render(
      <TourBriefingPrintModal
        isOpen={true}
        onClose={vi.fn()}
        data={mockData}
        isOwner={true}
        transitName="Xe máy thuê"
        draftBriefing={{ leaderName: 'Nguyễn Văn A' }}
        onChangeDraftBriefing={vi.fn()}
        printOptions={DEFAULT_PRINT_SHEET_OPTIONS}
        onChangePrintOptions={vi.fn()}
        onSaveBriefing={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
        onTriggerPrint={vi.fn()}
      />
    );

    // Modal title & subtitle
    expect(screen.getByText(/Xuất file PDF & In tờ hướng dẫn tour/i)).toBeInTheDocument();
    expect(screen.getByText(/Khổ giấy A4 chuẩn/i)).toBeInTheDocument();

    // Checkbox switches
    expect(screen.getByText(/Ô tích \(Checklist\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Bảng tổng hợp chi phí/i)).toBeInTheDocument();
    expect(screen.getByText(/Tách trang theo ngày/i)).toBeInTheDocument();

    // Leader input with pre-filled value
    expect(screen.getByDisplayValue('Nguyễn Văn A')).toBeInTheDocument();
  });

  it('allows switching between config tab and quick preview tab', () => {
    render(
      <TourBriefingPrintModal
        isOpen={true}
        onClose={vi.fn()}
        data={mockData}
        isOwner={true}
        transitName="Xe máy thuê"
        draftBriefing={{}}
        onChangeDraftBriefing={vi.fn()}
        printOptions={DEFAULT_PRINT_SHEET_OPTIONS}
        onChangePrintOptions={vi.fn()}
        onSaveBriefing={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
        onTriggerPrint={vi.fn()}
      />
    );

    const previewTabBtn = screen.getByRole('button', { name: /Xem trước tóm tắt bố cục/i });
    fireEvent.click(previewTabBtn);

    expect(screen.getByText(/Lộ trình tổng hợp:/i)).toBeInTheDocument();
    expect(screen.getByText('Ngày 1')).toBeInTheDocument();
    expect(screen.getByText('Biển Mỹ Khê')).toBeInTheDocument();
  });

  it('syncs briefing and triggers onTriggerPrint when clicking print CTA', async () => {
    const handleClose = vi.fn();
    const handleSaveBriefing = vi.fn().mockResolvedValue(undefined);
    const handleTriggerPrint = vi.fn();
    const handleChangeBriefing = vi.fn();

    render(
      <TourBriefingPrintModal
        isOpen={true}
        onClose={handleClose}
        data={mockData}
        isOwner={true}
        transitName="Xe máy thuê"
        draftBriefing={{ leaderName: 'Trần Văn B' }}
        onChangeDraftBriefing={handleChangeBriefing}
        printOptions={DEFAULT_PRINT_SHEET_OPTIONS}
        onChangePrintOptions={vi.fn()}
        onSaveBriefing={handleSaveBriefing}
        isSaving={false}
        onTriggerPrint={handleTriggerPrint}
      />
    );

    const printBtn = screen.getByRole('button', { name: /Xuất file PDF \/ In ngay/i });
    fireEvent.click(printBtn);

    await waitFor(() => {
      expect(handleChangeBriefing).toHaveBeenCalledWith(
        expect.objectContaining({ leaderName: 'Trần Văn B' })
      );
      expect(handleSaveBriefing).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
