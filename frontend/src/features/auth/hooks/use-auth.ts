'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  getAuthTransitionMessages,
  OAUTH_POPUP_CONFIG,
} from '@/features/auth/components/AuthTransitionScreen';
import { authService } from '@/services/auth.service';
import { AuthUser } from '@/types/auth';

const AUTH_QUERY_KEY = ['auth', 'me'];
const AUTH_SYNC_KEY = 'tripgenie:auth_event';
const USER_SCOPED_QUERY_PREFIXES = [
  ['planners'],
  ['saved-places'],
  ['collections'],
  ['itineraries'],
  ['community'],
  ['admin'],
  ['user-preferences'],
] as const;

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const {
    data: user,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<AuthUser | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: authService.getMe,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
    refetchOnWindowFocus: true,
  });

  // Cross-tab synchronization via localStorage storage event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === AUTH_SYNC_KEY) {
        if (event.newValue?.startsWith('logout')) {
          queryClient.setQueryData(AUTH_QUERY_KEY, null);
          for (const prefix of USER_SCOPED_QUERY_PREFIXES) {
            queryClient.removeQueries({ queryKey: prefix });
          }
          router.replace(OAUTH_POPUP_CONFIG.POST_LOGOUT_REDIRECT);
        } else if (event.newValue?.startsWith('login')) {
          queryClient.removeQueries({ queryKey: ['itineraries'] });
          queryClient.removeQueries({ queryKey: ['community'] });
          queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
        }
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [queryClient, router]);

  const broadcastAuthEvent = useCallback((event: 'login' | 'logout') => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(AUTH_SYNC_KEY, `${event}:${Date.now()}`);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const loginMutation = useMutation({
    mutationFn: authService.login,
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, data.user);
      queryClient.removeQueries({ queryKey: ['itineraries'] });
      queryClient.removeQueries({ queryKey: ['community'] });
      broadcastAuthEvent('login');
    },
  });

  const registerMutation = useMutation({
    mutationFn: authService.register,
  });

  const verifyEmailMutation = useMutation({
    mutationFn: authService.verifyEmail,
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, data.user);
      broadcastAuthEvent('login');
    },
  });

  const resendVerificationEmailMutation = useMutation({
    mutationFn: authService.resendVerificationEmail,
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: authService.forgotPassword,
  });

  const verifyResetOtpMutation = useMutation({
    mutationFn: authService.verifyResetOtp,
  });

  const resetPasswordMutation = useMutation({
    mutationFn: authService.resetPassword,
  });

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout().catch(() => ({ message: 'OK' })),
    onMutate: async () => {
      // Optimistic 0ms logout: clear session & navigate to Home immediately without waiting for network
      await queryClient.cancelQueries({ queryKey: AUTH_QUERY_KEY });
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      for (const prefix of USER_SCOPED_QUERY_PREFIXES) {
        queryClient.removeQueries({ queryKey: prefix });
      }
      broadcastAuthEvent('logout');
      toast.success(getAuthTransitionMessages().LOGOUT_SUCCESS);
      router.replace(OAUTH_POPUP_CONFIG.POST_LOGOUT_REDIRECT);
    },
  });

  return {
    user: user ?? null,
    isLoading,
    isError,
    error,
    isAuthenticated: !!user,
    refetchUser: refetch,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    verifyEmail: verifyEmailMutation.mutateAsync,
    isVerifyingEmail: verifyEmailMutation.isPending,
    resendVerificationEmail: resendVerificationEmailMutation.mutateAsync,
    isResendingVerificationEmail: resendVerificationEmailMutation.isPending,
    forgotPassword: forgotPasswordMutation.mutateAsync,
    isSubmittingForgotPassword: forgotPasswordMutation.isPending,
    verifyResetOtp: verifyResetOtpMutation.mutateAsync,
    isVerifyingResetOtp: verifyResetOtpMutation.isPending,
    resetPassword: resetPasswordMutation.mutateAsync,
    isResettingPassword: resetPasswordMutation.isPending,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    googleAuthUrl: authService.getGoogleAuthUrl(),
  };
}
