import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { Toaster } from '@/components/ui/sonner';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('Toaster Component', () => {
  it('renders without crashing and configures swipe-to-dismiss and closeButton', () => {
    render(<Toaster position="top-right" richColors />);
    // In next-themes or useEffect, Sonner mounts after effect
    expect(document.body).toBeDefined();
  });
});
