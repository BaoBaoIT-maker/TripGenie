import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CopilotDrawer, { CopilotMessageItem } from '@/features/planner/components/itinerary/CopilotDrawer';

vi.mock('@/services/place.service', () => ({
  placeService: {
    searchPlaces: vi.fn().mockResolvedValue({
      places: [
        {
          id: 'test-place-1',
          name: 'Hải Sản Bé Mặn',
          coverImage: 'https://images.unsplash.com/photo-test-beman',
          categoryLabel: 'Nhà hàng hải sản',
          address: 'Võ Nguyên Giáp, Đà Nẵng',
          latitude: 16.06,
          longitude: 108.24,
          rating: 4.6,
        },
      ],
    }),
  },
}));

describe('CopilotDrawer & Generative UI Place Recommendations', () => {
  const sampleMessages: CopilotMessageItem[] = [
    {
      sender: 'ai',
      text: 'Genie gợi ý bạn 2 quán ăn đặc sản nổi tiếng:\n1. **Hải Sản Bé Mặn** - Hải sản tươi sống ven biển Mỹ Khê.\n2. **Bánh Xèo Bà Dưỡng** - Bánh xèo nem lụi kiệt Hoàng Diệu.',
    },
  ];

  it('renders chat message without intrusive deep-link buttons in prose', () => {
    render(
      <CopilotDrawer
        isOpen={true}
        onClose={vi.fn()}
        destination="Đà Nẵng"
        messages={sampleMessages}
        isPending={false}
        onSendMessage={vi.fn()}
        onConfirmProposal={vi.fn()}
        onRejectProposal={vi.fn()}
        applyingProposalId={null}
      />
    );

    // Deep link inline buttons in prose should NOT exist
    const inlineChipButtons = screen.queryAllByTitle(/Bấm để xem ".*" trên bản đồ/);
    expect(inlineChipButtons.length).toBe(0);

    // Instead, names are rendered as semantic strong text
    const strongElements = screen.getAllByText('Hải Sản Bé Mặn');
    expect(strongElements.length).toBeGreaterThan(0);
  });

  it('renders recommendation cards with place thumbnail and harmonized action toolbar', async () => {
    const handleLocate = vi.fn();
    const handleSend = vi.fn();

    render(
      <CopilotDrawer
        isOpen={true}
        onClose={vi.fn()}
        destination="Đà Nẵng"
        days={[{ dayNumber: 1, theme: 'Khám phá biển', activities: [] }]}
        messages={sampleMessages}
        isPending={false}
        onSendMessage={handleSend}
        onConfirmProposal={vi.fn()}
        onRejectProposal={vi.fn()}
        applyingProposalId={null}
        onLocatePlaceOnMap={handleLocate}
      />
    );

    // Verify recommendation card section exists
    expect(screen.getByText('Gợi ý địa điểm:')).toBeInTheDocument();
    expect(screen.getByText('2 địa điểm')).toBeInTheDocument();

    // Verify action buttons exist on cards
    const addButtons = screen.getAllByRole('button', { name: /Thêm/ });
    expect(addButtons.length).toBeGreaterThanOrEqual(2);

    const swapButtons = screen.getAllByRole('button', { name: /Đổi/ });
    expect(swapButtons.length).toBeGreaterThanOrEqual(2);

    const mapButtons = screen.getAllByRole('button', { name: /Bản đồ/ });
    expect(mapButtons.length).toBeGreaterThanOrEqual(2);

    // Click "+ Thêm" button on the first card
    fireEvent.click(addButtons[0]);

    // Subpanel with day options should open
    expect(screen.getByText('Chọn ngày thêm vào lịch trình:')).toBeInTheDocument();
    const day1Btn = screen.getByRole('button', { name: /^Ngày 1$/ });
    expect(day1Btn).toBeInTheDocument();

    // Clicking Day 1 sends the structured add instruction
    fireEvent.click(day1Btn);
    expect(handleSend).toHaveBeenCalledWith('Thêm Hải Sản Bé Mặn vào Ngày 1');
  });
});
