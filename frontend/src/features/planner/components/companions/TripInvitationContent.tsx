'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin,
  CalendarDays,
  UserPlus,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Loader2,
  Compass,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  useTripInvitation,
  useAcceptInvitation,
  useDeclineInvitation,
} from '../../hooks/use-trip-companions';

interface TripInvitationContentProps {
  invitationId: string;
}

export function TripInvitationContent({ invitationId }: TripInvitationContentProps) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data: invitation, isLoading, isError, refetch } = useTripInvitation(invitationId);

  const acceptMutation = useAcceptInvitation();
  const declineMutation = useDeclineInvitation();

  if (isAuthLoading || isLoading) {
    return (
      <div className="max-w-md mx-auto py-16 px-4">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-lg space-y-6 animate-pulse">
          <div className="size-16 rounded-full bg-muted mx-auto" />
          <div className="h-6 w-3/4 bg-muted rounded-xl mx-auto" />
          <div className="h-28 bg-muted rounded-2xl" />
          <div className="h-10 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !invitation) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-lg space-y-4">
          <div className="size-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <XCircle className="size-8" />
          </div>
          <h1 className="text-lg font-bold font-heading text-foreground">
            Không tìm thấy lời mời
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Lời mời này không tồn tại, đã bị thu hồi hoặc chuyến đi đã bị xóa.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link href="/planner">
              <Button variant="outline" className="h-10 px-4 rounded-xl text-xs font-semibold cursor-pointer">
                Về Kế hoạch
              </Button>
            </Link>
            <Button
              onClick={() => refetch()}
              className="h-10 px-4 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Thử lại
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Guest authentication gate
  if (!user) {
    const nextUrl = encodeURIComponent(`/trip-invitations/${invitationId}`);
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-lg space-y-5">
          <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <UserPlus className="size-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold font-heading text-foreground">
              Lời mời tham gia chuyến đi
            </h1>
            <p className="text-xs text-muted-foreground">
              Vui lòng đăng nhập vào tài khoản TripGenie của bạn để xem và phản hồi lời mời.
            </p>
          </div>
          <Link href={`/login?next=${nextUrl}`}>
            <Button className="w-full h-11 rounded-xl text-xs font-semibold cursor-pointer shadow-xs">
              Đăng nhập để tiếp tục
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { status, itinerary, inviter } = invitation;

  // Terminal state: ACCEPTED
  if (status === 'ACCEPTED') {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-lg space-y-5">
          <div className="size-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="size-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold font-heading text-foreground">
              Bạn đã tham gia chuyến đi!
            </h1>
            <p className="text-xs text-muted-foreground">
              Bạn hiện là thành viên đồng hành của chuyến đi <strong>"{itinerary.title}"</strong>.
            </p>
          </div>
          <Link href={`/itineraries/${itinerary.id}`}>
            <Button className="w-full h-11 rounded-xl text-xs font-semibold gap-2 cursor-pointer shadow-xs">
              <span>Xem lịch trình chi tiết</span>
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Terminal state: DECLINED
  if (status === 'DECLINED') {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-lg space-y-4">
          <div className="size-14 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto">
            <XCircle className="size-8" />
          </div>
          <h1 className="text-lg font-bold font-heading text-foreground">
            Bạn đã từ chối lời mời này
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Nếu bạn muốn tham gia, hãy nhờ chủ chuyến đi gửi lại lời mời mới cho bạn nhé.
          </p>
          <Link href="/planner">
            <Button variant="outline" className="h-10 px-5 rounded-xl text-xs font-semibold cursor-pointer">
              Quay lại trang Kế hoạch
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Terminal state: EXPIRED or REVOKED
  if (status === 'EXPIRED' || status === 'REVOKED') {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-lg space-y-4">
          <div className="size-14 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
            <Clock className="size-8" />
          </div>
          <h1 className="text-lg font-bold font-heading text-foreground">
            Lời mời không còn khả dụng
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {status === 'EXPIRED'
              ? 'Lời mời này đã quá thời hạn 7 ngày.'
              : 'Lời mời này đã được người tạo chuyến đi thu hồi.'}
          </p>
          <Link href="/planner">
            <Button variant="outline" className="h-10 px-5 rounded-xl text-xs font-semibold cursor-pointer">
              Quay lại trang Kế hoạch
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Active PENDING invitation
  const handleAccept = () => {
    acceptMutation.mutate(invitationId, {
      onSuccess: (res) => {
        router.push(`/itineraries/${res.itineraryId}`);
      },
    });
  };

  const handleDecline = () => {
    declineMutation.mutate(invitationId, {
      onSuccess: () => {
        refetch();
      },
    });
  };

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <div className="rounded-3xl border border-border bg-card shadow-xl overflow-hidden space-y-6 p-6 sm:p-8">
        {/* Inviter Info Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-border">
          <Avatar className="size-12 border border-border shadow-xs shrink-0">
            <AvatarImage src={inviter.avatarUrl || undefined} alt={inviter.fullName} />
            <AvatarFallback className="text-sm font-bold bg-primary text-primary-foreground">
              {inviter.fullName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="text-xs text-muted-foreground">Lời mời đồng hành từ</div>
            <div className="text-base font-bold font-heading text-foreground">
              {inviter.fullName}
            </div>
          </div>
        </div>

        {/* Itinerary Preview Card */}
        <div className="rounded-2xl border border-border bg-muted/20 p-5 space-y-3.5">
          <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider">
            <Compass className="size-4" />
            <span>Kế hoạch chuyến đi</span>
          </div>

          <h2 className="text-lg font-bold font-heading text-foreground leading-snug">
            {itinerary.title}
          </h2>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {itinerary.destination && (
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <MapPin className="size-3.5 text-rose-500 shrink-0" />
                <span>{itinerary.destination}</span>
              </span>
            )}
            {itinerary.startDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5 text-primary shrink-0" />
                <span>
                  {itinerary.startDate}
                  {itinerary.endDate ? ` - ${itinerary.endDate}` : ''}
                </span>
              </span>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Tham gia để cùng theo dõi lịch trình, điểm dừng chân và đồng hành cùng {inviter.fullName} trong suốt chuyến đi.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleDecline}
            disabled={acceptMutation.isPending || declineMutation.isPending}
            className="w-full sm:w-1/3 h-11 rounded-xl text-xs font-semibold cursor-pointer order-2 sm:order-1"
          >
            {declineMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              'Từ chối'
            )}
          </Button>

          <Button
            type="button"
            onClick={handleAccept}
            disabled={acceptMutation.isPending || declineMutation.isPending}
            className="w-full sm:w-2/3 h-11 rounded-xl text-xs font-semibold gap-2 cursor-pointer shadow-xs order-1 sm:order-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {acceptMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="size-4" />
                <span>Tham gia chuyến đi</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
