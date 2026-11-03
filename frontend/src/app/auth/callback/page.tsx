'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/hooks/use-auth';

import { getSafeRedirectUrl } from '@/lib/safe-redirect';

function SafeCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const rawNext = searchParams.get('next');

  const { refetchUser } = useAuth();

  React.useEffect(() => {
    async function handleCallback() {
      if (error) {
        toast.error('Đăng nhập với Google không thành công.');
        router.push('/login');
        return;
      }

      try {
        const result = await refetchUser();
        if (result.data) {
          toast.success(`Chào mừng trở lại, ${result.data.fullName || 'bạn'}!`);
          const target = getSafeRedirectUrl(rawNext, '/explore');
          router.push(target);
          router.refresh();
        } else {
          router.push('/login');
        }
      } catch {
        toast.error('Lỗi khi thiết lập phiên làm việc.');
        router.push('/login');
      }
    }

    handleCallback();
  }, [error, rawNext, refetchUser, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground space-y-4">
      <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
        <Loader2 className="size-6 animate-spin" />
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-base font-bold font-heading">Đang hoàn tất đăng nhập Google...</h2>
        <p className="text-xs text-muted-foreground">Vui lòng chờ trong giây lát trong khi chúng tôi chuẩn bị dữ liệu của bạn.</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      }
    >
      <SafeCallbackHandler />
    </React.Suspense>
  );
}
