"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useAuthModalStore } from "@/features/auth/stores/auth-modal.store";
import { persistOAuthReturnUrl } from "@/lib/safe-redirect";
import { useI18n } from "@/i18n/LocaleProvider";
import {
  AuthHudPill,
  clearOAuthPopupMarkers,
  completeOAuthLoginSession,
  getAuthTransitionMessages,
  markOAuthPopupOpened,
  OAUTH_POPUP_CONFIG,
  type OAuthCallbackSignal,
} from "./AuthTransitionScreen";

interface GoogleAuthButtonProps {
  label?: string;
  className?: string;
}

export function GoogleAuthButton({
  label,
  className = "",
}: GoogleAuthButtonProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { googleAuthUrl, refetchUser } = useAuth();
  const { nextUrl, closeAuthModal } = useAuthModalStore();
  const resolvedLabel = label ?? t("auth.continueWithGoogle");

  const [isVerifying, setIsVerifying] = React.useState(false);
  const popupRef = React.useRef<Window | null>(null);
  const handledSignalRef = React.useRef(false);

  const cleanupPopup = React.useCallback(() => {
    clearOAuthPopupMarkers();
    if (popupRef.current && !popupRef.current.closed) {
      try {
        popupRef.current.close();
      } catch {
        // Ignore cross-origin close restrictions
      }
    }
    popupRef.current = null;
    setIsVerifying(false);
  }, []);

  const handleOAuthSignal = React.useCallback(
    async (signal: OAuthCallbackSignal) => {
      if (handledSignalRef.current) return;
      handledSignalRef.current = true;
      clearOAuthPopupMarkers();

      if (signal.status === "error") {
        cleanupPopup();
        toast.error(getAuthTransitionMessages().GOOGLE_OAUTH_FAILED);
        return;
      }

      const currentPath =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/";

      await completeOAuthLoginSession({
        refetchUser,
        rawNext: nextUrl,
        defaultPath: currentPath,
        onSuccessClose: () => {
          cleanupPopup();
          closeAuthModal();
        },
        onNavigate: (target) => {
          if (target !== currentPath) {
            router.replace(target);
          }
        },
        onError: () => {
          cleanupPopup();
        },
      });
    },
    [cleanupPopup, closeAuthModal, nextUrl, refetchUser, router]
  );

  React.useEffect(() => {
    if (!isVerifying || typeof window === "undefined") return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as OAuthCallbackSignal | undefined;
      if (data?.type === OAUTH_POPUP_CONFIG.MESSAGE_TYPE) {
        void handleOAuthSignal(data);
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== OAUTH_POPUP_CONFIG.STORAGE_KEY || !event.newValue) {
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue) as OAuthCallbackSignal;
        if (parsed?.type === OAUTH_POPUP_CONFIG.MESSAGE_TYPE) {
          void handleOAuthSignal(parsed);
        }
      } catch {
        // Ignore malformed storage payload
      }
    };

    // COOP-safe dismissal: when user closes the Google popup manually, focus returns to main window.
    // We wait FOCUS_DISMISS_DELAY_MS for any pending storage signal before dismissing the HUD pill.
    let focusTimer: number | undefined;
    const onWindowFocus = () => {
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        if (!handledSignalRef.current) {
          cleanupPopup();
        }
      }, OAUTH_POPUP_CONFIG.FOCUS_DISMISS_DELAY_MS);
    };

    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onWindowFocus);

    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onWindowFocus);
      window.clearTimeout(focusTimer);
    };
  }, [isVerifying, handleOAuthSignal, cleanupPopup]);

  const handleGoogleClick = () => {
    persistOAuthReturnUrl(nextUrl);
    handledSignalRef.current = false;
    markOAuthPopupOpened();

    if (typeof window === "undefined") return;

    const left = Math.max(
      0,
      Math.round(window.screenX + (window.outerWidth - OAUTH_POPUP_CONFIG.WIDTH) / 2)
    );
    const top = Math.max(
      0,
      Math.round(window.screenY + (window.outerHeight - OAUTH_POPUP_CONFIG.HEIGHT) / 2)
    );
    const features = `popup=yes,width=${OAUTH_POPUP_CONFIG.WIDTH},height=${OAUTH_POPUP_CONFIG.HEIGHT},left=${left},top=${top}`;

    const popup = window.open(
      googleAuthUrl,
      OAUTH_POPUP_CONFIG.WINDOW_NAME,
      features
    );

    if (!popup) {
      clearOAuthPopupMarkers();
      window.location.href = googleAuthUrl;
      return;
    }

    popupRef.current = popup;
    popup.focus();
    setIsVerifying(true);
  };

  return (
    <>
      <button
        type="button"
        disabled={isVerifying}
        onClick={handleGoogleClick}
        className={`w-full h-11 flex items-center justify-center gap-3 px-4 rounded-xl border border-border/80 bg-background hover:bg-muted/60 text-foreground text-sm font-semibold transition-all duration-200 shadow-2xs hover:shadow-xs active:scale-[0.99] cursor-pointer disabled:opacity-60 ${className}`}
      >
        <svg className="size-4.5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>
          {isVerifying ? t("auth.verifying") : resolvedLabel}
        </span>
      </button>

      {isVerifying &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[120] bg-[#10243A]/35 backdrop-blur-[2px] flex items-center justify-center p-4">
            <AuthHudPill
              label={t("auth.verifying")}
              onCancel={cleanupPopup}
            />
          </div>,
          document.body
        )}
    </>
  );
}
