import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { PostCard } from '@/components/community/PostCard';
import type { CommunityPostItem } from '@/types/community';

// Mock community mutation hooks
vi.mock('@/features/community/hooks/use-community', () => ({
  useTogglePostLike: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCommunityPost: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Mock auth hook
vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { id: 'u1', fullName: 'Tester' } }),
}));

const mockPost: CommunityPostItem = {
  id: 'post-test-1',
  authorId: 'u2',
  title: 'Chuyến đi Đà Nẵng 3N2Đ tuyệt vời',
  caption: 'Chia sẻ kinh nghiệm đi Bà Nà Hills và cầu Rồng buổi tối.',
  mediaUrls: [],
  tags: ['#danang', '#travel'],
  likeCount: 42,
  commentCount: 5,
  cloneCount: 12,
  isLiked: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  author: {
    id: 'u2',
    fullName: 'Hoàng Long',
    username: 'hoanglong',
    avatarUrl: '',
    isVerified: true,
  },
  itinerary: {
    id: 'itin-1',
    title: 'Lịch trình Đà Nẵng - Hội An 3N2Đ',
    destination: 'Đà Nẵng',
    totalPlaces: 6,
    startDate: '2026-06-01',
    endDate: '2026-06-03',
  },
};

describe('Community Typography & Anti-Slop Specs', () => {
  it('renders author name and post title with font-bold instead of font-black', () => {
    render(<PostCard post={mockPost} />);

    // Author Link
    const authorLink = screen.getByText('Hoàng Long');
    expect(authorLink).toBeInTheDocument();
    expect(authorLink.className).toContain('font-bold');
    expect(authorLink.className).toContain('text-slate-900');
    expect(authorLink.className).not.toContain('font-black');

    // Post Title
    const titleElement = screen.getByText('Chuyến đi Đà Nẵng 3N2Đ tuyệt vời');
    expect(titleElement).toBeInTheDocument();
    expect(titleElement.className).toContain('font-bold');
    expect(titleElement.className).toContain('text-slate-900');
    expect(titleElement.className).not.toContain('font-black');
  });

  it('renders hashtags as clean inline text buttons instead of boxed pill capsules', () => {
    render(<PostCard post={mockPost} />);

    const tag1 = screen.getByText('#danang');
    expect(tag1).toBeInTheDocument();
    expect(tag1.className).toContain('text-[#0194F3]');
    expect(tag1.className).toContain('font-semibold');
    expect(tag1.className).not.toContain('rounded-[6px]');
    expect(tag1.className).not.toContain('bg-[#F0F7FF]');
  });

  it('renders attached itinerary strip with streamlined dimensions and readable typography', () => {
    render(<PostCard post={mockPost} />);

    const itinTitle = screen.getByText('Lịch trình Đà Nẵng - Hội An 3N2Đ');
    expect(itinTitle).toBeInTheDocument();
    expect(itinTitle.className).toContain('font-bold');
    expect(itinTitle.className).toContain('text-slate-900');

    const cloneBtn = screen.getByText('Nhân bản lịch trình');
    expect(cloneBtn).toBeInTheDocument();
    expect(cloneBtn.closest('button')?.className).toContain('h-8');
    expect(cloneBtn.closest('button')?.className).toContain('rounded-lg');
  });
});
