'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  AUTH_TRANSITION_MESSAGES,
  AuthTransitionScreen,
  completeOAuthLoginSession,
  consumeOAuthPopupPendingFlag,
  OAUTH_POPUP_CONFIG,
  type OAuthCallbackSignal,
} from '@/features/auth/components/AuthTransitionScreen';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { apiClient } from '@/lib/api-client';
import { consumeOAuthReturnUrl } from '@/lib/safe-redirect';

function notifyOpenerAndClose(
  isPopupContext: boolean,
  signal: OAuthCallbackSignal,
): boolean {
  if (!isPopupContext || typeof window === 'undefined') return false;

  try {
    localStorage.setItem(
      OAUTH_POPUP_CONFIG.STORAGE_KEY,
      JSON.stringify(signal),
    );
  } catch {
    // Ignore storage quota/privacy mode errors
  }

  try {
    window.opener?.postMessage(signal, window.location.origin);
  } catch {
    // Ignore cross-origin opener errors
  }

  try {
    window.close();
  } catch {
    // Ignore close errors
  }

  return true;
}

function SafeCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const rawNext = searchParams.get('next');
  const accessToken = searchParams.get('accessToken');
  const refreshToken = searchParams.get('refreshToken');

  const { refetchUser } = useAuth();

  React.useEffect(() => {
    const isPopupContext = consumeOAuthPopupPendingFlag();

    async function handleCallback() {
      if (error) {
        if (
          notifyOpenerAndClose(isPopupContext, {
            type: OAUTH_POPUP_CONFIG.MESSAGE_TYPE,
            status: 'error',
            error,
            timestamp: Date.now(),
          })
        ) {
          return;
        }
        consumeOAuthReturnUrl(rawNext);
        toast.error(AUTH_TRANSITION_MESSAGES.GOOGLE_OAUTH_FAILED);
        router.replace(OAUTH_POPUP_CONFIG.LOGIN_ERROR_REDIRECT);
        return;
      }

      if (accessToken && refreshToken) {
        try {
          await apiClient('/auth/session', {
            method: 'POST',
            body: JSON.stringify({ accessToken, refreshToken }),
          });
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch {
          // fallback to cookies set by backend redirect
        }
      }

      if (
        notifyOpenerAndClose(isPopupContext, {
          type: OAUTH_POPUP_CONFIG.MESSAGE_TYPE,
          status: 'success',
          timestamp: Date.now(),
        })
      ) {
        return;
      }

      await completeOAuthLoginSession({
        refetchUser,
        rawNext,
        defaultPath: '/',
        onNavigate: (target) => router.replace(target),
        onError: () => router.replace(OAUTH_POPUP_CONFIG.LOGIN_ERROR_REDIRECT),
      });
    }

    void handleCallback();
  }, [error, rawNext, accessToken, refreshToken, refetchUser, router]);

  return <AuthTransitionScreen title={AUTH_TRANSITION_MESSAGES.VERIFYING} />;
}

export default function AuthCallbackPage() {
  return (
    <React.Suspense
      fallback={
        <AuthTransitionScreen title={AUTH_TRANSITION_MESSAGES.VERIFYING} />
      }
    >
      <SafeCallbackHandler />
    </React.Suspense>
  );
}
