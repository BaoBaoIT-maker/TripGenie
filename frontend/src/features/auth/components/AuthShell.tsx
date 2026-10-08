'use client';

import * as React from 'react';
import Link from 'next/link';
import { Compass, Sparkles, MapPin, Star } from 'lucide-react';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="min-h-screen w-full flex bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* Left side: Premium Travel Showcase (Desktop lg+) */}
      <div className="hidden lg:relative lg:flex lg:w-1/2 xl:w-7/12 flex-col justify-between p-12 overflow-hidden bg-slate-900 text-white">
        {/* Background Image with Cinematic Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105 hover:scale-100"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1528127269322-539801943592?q=80&w=2070&auto=format&fit=crop")',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-900/30" />
        <div className="absolute inset-0 bg-primary/10 mix-blend-overlay" />

        {/* Top Branding on Left */}
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
              <Compass className="size-6 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-xl font-bold tracking-tight text-white">
                TripGenie
              </span>
              <span className="text-[10px] tracking-wider uppercase text-emerald-300 font-semibold">
                Du lịch cá nhân hóa
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-medium text-white/90">
            <Sparkles className="size-3.5 text-amber-300" />
            <span>AI Travel Assistant</span>
          </div>
        </div>

        {/* Center / Bottom Highlights */}
        <div className="relative z-10 space-y-6 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold backdrop-blur-sm">
            <MapPin className="size-3.5" />
            <span>Đà Nẵng • Hội An • Phú Quốc</span>
          </div>

          <h2 className="font-heading text-3xl xl:text-4xl font-bold tracking-tight text-white leading-tight">
            Khám phá trọn vẹn vẻ đẹp Việt Nam theo cách riêng của bạn.
          </h2>

          <p className="text-white/80 text-sm leading-relaxed">
            Hàng ngàn địa điểm chọn lọc, gợi ý lịch trình thông minh tối ưu hóa thời gian và ngân sách cá nhân từ trợ lý TripGenie.
          </p>

          {/* Social Proof Mini Card */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 max-w-md shadow-xl">
            <div className="flex -space-x-2">
              <div className="size-9 rounded-full border-2 border-white bg-amber-500 flex items-center justify-center text-xs font-bold text-white">
                AN
              </div>
              <div className="size-9 rounded-full border-2 border-white bg-teal-500 flex items-center justify-center text-xs font-bold text-white">
                TP
              </div>
              <div className="size-9 rounded-full border-2 border-white bg-indigo-500 flex items-center justify-center text-xs font-bold text-white">
                HL
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1 text-amber-300">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="size-3.5 fill-current" />
                ))}
              </div>
              <p className="text-xs text-white/90 mt-0.5 font-medium">
                Hơn 10,000+ lịch trình đã được tối ưu hóa
              </p>
            </div>
          </div>
        </div>

        {/* Left Bottom Copyright */}
        <div className="relative z-10 text-xs text-white/60">
          © {new Date().getFullYear()} TripGenie Inc. Bản quyền thuộc về TripGenie.
        </div>
      </div>

      {/* Right side: Clean, Focused Auth Container */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 md:px-8 py-10 lg:py-16 overflow-y-auto">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Brand Header */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md">
                <Compass className="size-5" />
              </div>
              <span className="font-heading text-xl font-bold tracking-tight text-foreground">
                TripGenie
              </span>
            </Link>
          </div>

          {/* Form Header */}
          <div className="text-center lg:text-left space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading text-foreground">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {subtitle}
            </p>
          </div>

          {/* The Form Content Slot */}
          <div className="bg-card border border-border/80 rounded-3xl p-6 sm:p-8 shadow-sm">
            {children}
          </div>

          {/* Footer Terms */}
          <p className="text-center text-xs text-muted-foreground px-4 leading-relaxed">
            Bằng việc tiếp tục, bạn đồng ý với{' '}
            <Link href="/" className="text-primary hover:underline font-medium">
              Điều khoản dịch vụ
            </Link>{' '}
            và{' '}
            <Link href="/" className="text-primary hover:underline font-medium">
              Chính sách bảo mật
            </Link>{' '}
            của TripGenie.
          </p>
        </div>
      </div>
    </div>
  );
}
