"use client";

import { toast } from "sonner";
import {
  consumeOAuthReturnUrl,
  resolvePostLoginRedirect,
} from "@/lib/safe-redirect";
import { getActiveClientLocale, type Locale } from "@/i18n/config";
import { getMessages, translate } from "@/i18n";
import { useI18n } from "@/i18n/LocaleProvider";
import type { AuthUser } from "@/types/auth";

export const OAUTH_POPUP_CONFIG = {
  WINDOW_NAME: "tripgenie_google_oauth",
  PENDING_STORAGE_KEY: "tripgenie:oauth_pending_popup",
  STORAGE_KEY: "tripgenie:oauth_result",
  MESSAGE_TYPE: "TRIPGENIE_OAUTH_CALLBACK",
  WIDTH: 520,
  HEIGHT: 640,
  PENDING_TTL_MS: 2 * 60 * 1000,
  FOCUS_DISMISS_DELAY_MS: 700,
  LOGIN_ERROR_REDIRECT: "/?auth=login",
  POST_LOGOUT_REDIRECT: "/",
} as const;

export function getAuthTransitionMessages(locale: Locale = getActiveClientLocale()) {
  const auth = getMessages(locale).auth;
  return {
    VERIFYING: auth.verifying,
    LOGGING_OUT: auth.loggingOut,
    CANCEL: auth.cancel,
    GOOGLE_OAUTH_FAILED: auth.googleOAuthFailed,
    SESSION_ESTABLISH_FAILED: auth.sessionEstablishFailed,
    LOGOUT_SUCCESS: auth.logoutSuccess,
    WELCOME_BACK: (fullName?: string | null) =>
      translate(locale, "auth.welcomeBack", {
        name: fullName || auth.welcomeBackFallbackName,
      }),
  };
}

export const AUTH_TRANSITION_MESSAGES = getAuthTransitionMessages();

export interface OAuthCallbackSignal {
  type: typeof OAUTH_POPUP_CONFIG.MESSAGE_TYPE;
  status: "success" | "error";
  error?: string;
  timestamp: number;
}

/**
 * Records a short-lived timestamp in localStorage before opening the Google OAuth popup.
 * Necessary because accounts.google.com sends Cross-Origin-Opener-Policy: same-origin,
 * which severs window.opener and resets window.name to "" in modern browsers.
 */
export function markOAuthPopupOpened(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(OAUTH_POPUP_CONFIG.STORAGE_KEY);
    localStorage.setItem(
      OAUTH_POPUP_CONFIG.PENDING_STORAGE_KEY,
      String(Date.now())
    );
  } catch {
    // Ignore storage errors
  }
}

export function clearOAuthPopupMarkers(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(OAUTH_POPUP_CONFIG.PENDING_STORAGE_KEY);
    localStorage.removeItem(OAUTH_POPUP_CONFIG.STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Consumes the pending popup marker on /auth/callback and determines whether
 * the callback is executing inside the OAuth popup window.
 */
export function consumeOAuthPopupPendingFlag(): boolean {
  if (typeof window === "undefined") return false;

  let hasValidPendingFlag = false;
  try {
    const raw = localStorage.getItem(OAUTH_POPUP_CONFIG.PENDING_STORAGE_KEY);
    if (raw) {
      localStorage.removeItem(OAUTH_POPUP_CONFIG.PENDING_STORAGE_KEY);
      const openedAt = Number(raw);
      if (
        Number.isFinite(openedAt) &&
        Date.now() - openedAt <= OAUTH_POPUP_CONFIG.PENDING_TTL_MS
      ) {
        hasValidPendingFlag = true;
      }
    }
  } catch {
    // Ignore storage errors
  }

  return (
    hasValidPendingFlag ||
    window.name === OAUTH_POPUP_CONFIG.WINDOW_NAME ||
    Boolean(window.opener)
  );
}

/**
 * Shared post-OAuth session completion helper (used by both in-place Popup and full-tab fallback).
 */
export async function completeOAuthLoginSession(params: {
  refetchUser: () => Promise<{ data?: AuthUser | null }>;
  rawNext?: string | null;
  defaultPath: string;
  onSuccessClose?: () => void;
  onNavigate: (target: string) => void;
  onError: () => void;
}): Promise<void> {
  const {
    refetchUser,
    rawNext,
    defaultPath,
    onSuccessClose,
    onNavigate,
    onError,
  } = params;

  try {
    const result = await refetchUser();
    if (!result.data) {
      onError();
      return;
    }

    onSuccessClose?.();
    const transitionMsg = getAuthTransitionMessages();
    toast.success(transitionMsg.WELCOME_BACK(result.data.fullName));
    const consumedNext = consumeOAuthReturnUrl(rawNext, defaultPath);
    const target = resolvePostLoginRedirect(
      result.data.role,
      consumedNext,
      defaultPath
    );
    onNavigate(target);
  } catch {
    toast.error(getAuthTransitionMessages().SESSION_ESTABLISH_FAILED);
    onError();
  }
}

interface AuthHudPillProps {
  label?: string;
  onCancel?: () => void;
}

/**
 * Honkai: Star Rail / HoYoverse-inspired Compact Verification HUD Pill.
 * 100% pure CSS (0 KB image assets, 0 layout shift, renders in 0ms).
 */
export function AuthHudPill({
  label,
  onCancel,
}: AuthHudPillProps) {
  const { t } = useI18n();
  const resolvedLabel = label ?? t("auth.verifying");

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-[#10243A]/95 text-white border border-white/15 shadow-2xl backdrop-blur-md font-sans select-none"
    >
      <i
        className="fa-solid fa-circle-notch fa-spin text-[#0194F3] text-sm shrink-0"
        aria-hidden="true"
      />
      <span className="text-xs sm:text-sm font-bold tracking-tight whitespace-nowrap">
        {resolvedLabel}
      </span>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("auth.cancelVerifyAria")}
          className="ml-1 pl-2.5 border-l border-white/15 text-[11px] font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          {t("auth.cancel")}
        </button>
      )}
    </div>
  );
}

interface AuthTransitionScreenProps {
  title?: string;
}

/**
 * Lightweight full-viewport HUD overlay used only during brief popup handoff or protected-route exit.
 * Zero logo/avatar image downloads.
 */
export function AuthTransitionScreen({
  title,
}: AuthTransitionScreenProps) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen w-full bg-[#10243A]/20 backdrop-blur-[2px] flex items-center justify-center p-4">
      <AuthHudPill label={title ?? t("auth.verifying")} />
    </div>
  );
}
