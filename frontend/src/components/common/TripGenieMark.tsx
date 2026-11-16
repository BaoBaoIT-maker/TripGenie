import * as React from 'react';
import { cn } from '@/lib/utils';

interface TripGenieMarkProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * Isolated vector emblem derived from `/images/logo_transparent.png` (pocket compass,
 * twin mountains, and upward arrow without the bottom wordmark) so the TripGenie mark
 * stays crisp at compact sizes (16px–44px) across both light and dark surfaces.
 */
export function TripGenieMark({ className, ...props }: TripGenieMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('shrink-0', className)}
      {...props}
    >
      {/* Top compass loop */}
      <circle
        cx="50"
        cy="11"
        r="5.5"
        stroke="#0194F3"
        strokeWidth="4.2"
      />

      {/* Outer compass arc with gap at 1 o'clock for arrow */}
      <path
        d="M 73.5 32.5 A 36 36 0 1 1 59 21.5"
        stroke="#0194F3"
        strokeWidth="6.5"
        strokeLinecap="round"
      />

      {/* Subtle compass ticks */}
      <g stroke="#0194F3" strokeWidth="2.6" strokeLinecap="round">
        <line x1="50" y1="26" x2="50" y2="31" />
        <line x1="20" y1="56" x2="25" y2="56" />
        <line x1="75" y1="56" x2="80" y2="56" />
        <line x1="29" y1="35" x2="32.5" y2="38.5" />
        <line x1="35" y1="29" x2="37.5" y2="33" />
      </g>

      {/* Left mountain mass (Electric Sky Blue) */}
      <path
        d="M 22 76 L 36.5 47 L 48.5 64 L 56 54 L 64 78 A 31 31 0 0 1 22 76 Z"
        fill="#0194F3"
      />

      {/* Right tall mountain shaded face (Deep Travel Navy) */}
      <path
        d="M 59 41 L 78 72 A 31 31 0 0 1 54 87 L 54 64 L 59 41 Z"
        className="fill-[#10243A] dark:fill-sky-200"
      />

      {/* Upward-right compass arrow */}
      <path
        d="M 41 66 L 69 21 L 63 18.5 L 78 9.5 L 76.5 26.5 L 72 23.5 L 44.5 68 Z"
        fill="#0194F3"
      />
    </svg>
  );
}
