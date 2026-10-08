'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useCallback } from 'react';
import { authService } from '@/services/auth.service';
import { AuthUser } from '@/types/auth';

const AUTH_QUERY_KEY = ['auth', 'me'];
const AUTH_SYNC_KEY = 'tripgenie:auth_event';

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
          queryClient.invalidateQueries();
          router.push('/login');
        } else if (event.newValue?.startsWith('login')) {
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
      broadcastAuthEvent('login');
    },
  });

  const registerMutation = useMutation({
    mutationFn: authService.register,
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, data.user);
      broadcastAuthEvent('login');
    },
  });

  const reauthenticateMutation = useMutation({
    mutationFn: (password: string) => authService.reauthenticate(password),
  });

  const startGoogleLinkMutation = useMutation({
    mutationFn: ({ grantToken, returnUrl }: { grantToken: string; returnUrl?: string }) =>
      authService.startGoogleLink(grantToken, returnUrl),
  });

  const updateUsernameMutation = useMutation({
    mutationFn: (username: string) => authService.updateUsername(username),
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, data.user);
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: authService.verifyOtp,
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, data.user);
      broadcastAuthEvent('login');
    },
  });

  const resendOtpMutation = useMutation({
    mutationFn: authService.resendOtp,
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
    mutationFn: authService.logout,
    onSettled: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.removeQueries({ queryKey: ['planners'] });
      queryClient.removeQueries({ queryKey: ['saved-places'] });
      broadcastAuthEvent('logout');
      router.push('/login');
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
    reauthenticate: reauthenticateMutation.mutateAsync,
    isReauthenticating: reauthenticateMutation.isPending,
    startGoogleLink: startGoogleLinkMutation.mutateAsync,
    isStartingGoogleLink: startGoogleLinkMutation.isPending,
    updateUsername: updateUsernameMutation.mutateAsync,
    isUpdatingUsername: updateUsernameMutation.isPending,
    verifyOtp: verifyOtpMutation.mutateAsync,
    isVerifyingOtp: verifyOtpMutation.isPending,
    resendOtp: resendOtpMutation.mutateAsync,
    isResendingOtp: resendOtpMutation.isPending,
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
