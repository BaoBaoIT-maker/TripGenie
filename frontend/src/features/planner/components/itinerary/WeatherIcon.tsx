'use client';

import React, { useState } from 'react';
import type { WeatherCondition } from '@/types/itinerary';
import { getMsnWeatherIconUrl } from '../../constants/climate.constants';
import { Sun, CloudSun, CloudRain, Snowflake } from 'lucide-react';

export interface WeatherIconProps {
  condition: WeatherCondition;
  weatherCode?: number | null;
  className?: string;
  size?: number;
  alt?: string;
}

/**
 * Renders authentic MSN Weather taskbar v10 vector SVG weather icons.
 * Gracefully falls back to crisp Lucide icon vectors if the external CDN fails or is offline (C-4 Resilience).
 */
export function WeatherIcon({
  condition,
  weatherCode,
  className = 'size-4 object-contain shrink-0',
  size = 16,
  alt,
}: WeatherIconProps) {
  const [hasError, setHasError] = useState(false);
  const iconUrl = getMsnWeatherIconUrl(condition, weatherCode);

  if (hasError) {
    const iconSize = size <= 14 ? 14 : size <= 16 ? 16 : 18;
    if (condition === 'SUNNY') {
      return <Sun size={iconSize} className="text-amber-500 shrink-0" aria-hidden="true" />;
    }
    if (condition === 'MILD') {
      return <CloudSun size={iconSize} className="text-[#0194F3] shrink-0" aria-hidden="true" />;
    }
    if (condition === 'RAINY') {
      return <CloudRain size={iconSize} className="text-sky-600 shrink-0" aria-hidden="true" />;
    }
    return <Snowflake size={iconSize} className="text-indigo-500 shrink-0" aria-hidden="true" />;
  }

  return (
    <img
      src={iconUrl}
      alt={alt || condition}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}

export default WeatherIcon;
