import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModalCopilotAssist } from '@/features/planner/components/itinerary/ModalCopilotAssist';

describe('ModalCopilotAssist Component', () => {
  it('renders capabilities summary and toggles capability details', () => {
    const handleAskCopilot = vi.fn();
    render(
      <ModalCopilotAssist
        context="swap"
        placeName="Bảo tàng Điêu khắc Chăm"
        dayNumber={1}
        canEdit={true}
        onAskCopilot={handleAskCopilot}
      />
    );

    // Title and toggle button should be present
    expect(screen.getByText('Trợ lý Genie Copilot có thể làm gì?')).toBeInTheDocument();
    const toggleBtn = screen.getByRole('button', { name: /Xem 5 khả năng/i });
    expect(toggleBtn).toBeInTheDocument();

    // Click toggle button to show all 5 capabilities
    fireEvent.click(toggleBtn);
    expect(screen.getByText('Đổi địa điểm theo gu')).toBeInTheDocument();
    expect(screen.getByText('Chuyển ngày linh hoạt')).toBeInTheDocument();
    expect(screen.getByText('Hoán đổi 2 ngày')).toBeInTheDocument();
    expect(screen.getByText('Thêm điểm tiện đường')).toBeInTheDocument();
    expect(screen.getByText('Cân đối thời gian')).toBeInTheDocument();
  });

  it('triggers onAskCopilot with quick chip prompt when clicked', () => {
    const handleAskCopilot = vi.fn();
    render(
      <ModalCopilotAssist
        context="swap"
        placeName="Cầu Rồng"
        dayNumber={1}
        canEdit={true}
        onAskCopilot={handleAskCopilot}
      />
    );

    const quietChip = screen.getByRole('button', { name: /Ít đông \/ yên tĩnh hơn/i });
    fireEvent.click(quietChip);

    expect(handleAskCopilot).toHaveBeenCalledWith(
      expect.stringContaining('Cầu Rồng')
    );
  });

  it('renders primary open Copilot button and triggers with default context prompt', () => {
    const handleAskCopilot = vi.fn();
    render(
      <ModalCopilotAssist
        context="add"
        dayNumber={2}
        canEdit={true}
        onAskCopilot={handleAskCopilot}
      />
    );

    const openBtn = screen.getByRole('button', { name: /Mở trợ lý Copilot/i });
    fireEvent.click(openBtn);

    expect(handleAskCopilot).toHaveBeenCalledWith(
      'Gợi ý cho tôi một địa điểm phù hợp để thêm vào Ngày 2'
    );
  });
});
