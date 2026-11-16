import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EditItineraryMetaDialog } from '@/features/planner/components/itinerary/EditItineraryMetaDialog';

describe('EditItineraryMetaDialog Component', () => {
  it('renders title, description and date inputs with current total days', () => {
    render(
      <EditItineraryMetaDialog
        open={true}
        onClose={vi.fn()}
        title="Khám phá Đà Nẵng"
        description="Chuyến đi 3 ngày"
        startDate="2025-12-01"
        endDate="2025-12-03"
        totalDays={3}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('Khám phá Đà Nẵng')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Chuyến đi 3 ngày')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2025-12-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2025-12-03')).toBeInTheDocument();
    expect(screen.getByText(/3 ngày 2 đêm/)).toBeInTheDocument();
  });

  it('shows reduce days confirmation, closes dialog and calls onSubmit on confirm', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();
    render(
      <EditItineraryMetaDialog
        open={true}
        onClose={handleClose}
        title="Khám phá Đà Nẵng"
        description="Chuyến đi 5 ngày"
        startDate="2025-12-01"
        endDate="2025-12-05"
        totalDays={5}
        onSubmit={handleSubmit}
      />
    );

    // Change end date from 2025-12-05 to 2025-12-03 (5 days -> 3 days)
    const endDateInput = screen.getByDisplayValue('2025-12-05');
    fireEvent.change(endDateInput, { target: { value: '2025-12-03' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Lưu thay đổi/i });
    fireEvent.click(submitBtn);

    // Should transition to reduce days confirmation step
    await waitFor(() => {
      expect(screen.getByText(/Số ngày giảm từ 5 ngày xuống 3 ngày/i)).toBeInTheDocument();
      expect(screen.getByText(/Dồn vào ngày cuối/i)).toBeInTheDocument();
      expect(screen.getByText(/Xóa các điểm vượt quá/i)).toBeInTheDocument();
    });

    // Confirm shift with default 'merge'
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận dời ngày/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        title: 'Khám phá Đà Nẵng',
        description: 'Chuyến đi 5 ngày',
        startDate: '2025-12-01',
        endDate: '2025-12-03',
        dayShiftMode: 'merge',
      });
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('shows expand days confirmation, allows selecting option, closes dialog and triggers Copilot', async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();
    const handleAskCopilot = vi.fn();
    render(
      <EditItineraryMetaDialog
        open={true}
        onClose={handleClose}
        title="Khám phá Đà Nẵng"
        description=""
        startDate="2025-12-01"
        endDate="2025-12-03"
        totalDays={3}
        onSubmit={handleSubmit}
        onAskCopilot={handleAskCopilot}
      />
    );

    // Change end date from 2025-12-03 to 2025-12-05 (3 days -> 5 days)
    const endDateInput = screen.getByDisplayValue('2025-12-03');
    fireEvent.change(endDateInput, { target: { value: '2025-12-05' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Lưu thay đổi/i });
    fireEvent.click(submitBtn);

    // Should transition to expand confirmation step with radio choices
    await waitFor(() => {
      expect(screen.getByText(/Lịch trình được tăng từ 3 ngày lên 5 ngày/i)).toBeInTheDocument();
      expect(screen.getByText(/Nhờ Genie Copilot gợi ý điểm mới/i)).toBeInTheDocument();
      expect(screen.getByText(/Tự thêm điểm sau/i)).toBeInTheDocument();
    });

    // Confirm shift with default 'copilot' option
    const confirmBtn = screen.getByRole('button', { name: /Xác nhận dời ngày/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        title: 'Khám phá Đà Nẵng',
        description: '',
        startDate: '2025-12-01',
        endDate: '2025-12-05',
        dayShiftMode: 'merge',
      });
      expect(handleClose).toHaveBeenCalled();
      expect(handleAskCopilot).toHaveBeenCalledWith(
        expect.stringContaining('Lịch trình vừa được mở rộng lên 5 ngày')
      );
    });
  });
});
