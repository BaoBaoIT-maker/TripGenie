import { create } from 'zustand';

export type AuthModalView =
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'verify-otp'
  | 'reset-password'
  | 'verify-email';

interface AuthModalState {
  isOpen: boolean;
  view: AuthModalView;
  emailForOtp?: string;
  verifyToken?: string;
  nextUrl?: string;
  openAuthModal: (
    view?: AuthModalView,
    options?: { email?: string; token?: string; nextUrl?: string }
  ) => void;
  closeAuthModal: () => void;
  setView: (
    view: AuthModalView,
    options?: { email?: string; token?: string }
  ) => void;
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  isOpen: false,
  view: 'login',
  emailForOtp: undefined,
  verifyToken: undefined,
  nextUrl: undefined,
  openAuthModal: (view = 'login', options) =>
    set({
      isOpen: true,
      view,
      emailForOtp: options?.email,
      verifyToken: options?.token,
      nextUrl: options?.nextUrl,
    }),
  closeAuthModal: () =>
    set({
      isOpen: false,
      emailForOtp: undefined,
      verifyToken: undefined,
      nextUrl: undefined,
    }),
  setView: (view, options) =>
    set((state) => ({
      view,
      emailForOtp: options?.email ?? state.emailForOtp,
      verifyToken: options?.token ?? state.verifyToken,
    })),
}));
