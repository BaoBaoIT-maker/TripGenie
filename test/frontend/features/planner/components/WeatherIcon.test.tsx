import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import React from 'react';
import { WeatherIcon } from '@/features/planner/components/itinerary/WeatherIcon';
import { MSN_WEATHER_BASE_URL } from '@/features/planner/constants/climate.constants';

describe('WeatherIcon component', () => {
  it('renders authentic MSN SVG for SUNNY condition', () => {
    render(<WeatherIcon condition="SUNNY" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', `${MSN_WEATHER_BASE_URL}/SunnyDayV3.svg`);
    expect(img).toHaveAttribute('width', '16');
    expect(img).toHaveAttribute('height', '16');
  });

  it('renders authentic MSN SVG for RAINY condition with weatherCode', () => {
    render(<WeatherIcon condition="RAINY" weatherCode={61} size={20} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', `${MSN_WEATHER_BASE_URL}/RainShowersDayV2.svg`);
    expect(img).toHaveAttribute('width', '20');
  });

  it('renders ThunderstormsV2 for severe storm weatherCode >= 95', () => {
    render(<WeatherIcon condition="RAINY" weatherCode={95} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', `${MSN_WEATHER_BASE_URL}/ThunderstormsV2.svg`);
  });

  it('gracefully degrades to Lucide vector icon on network error (C-4 Resilience)', () => {
    render(<WeatherIcon condition="SUNNY" />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();

    // Trigger image loading failure
    fireEvent.error(img);

    // img is replaced by SVG fallback
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
