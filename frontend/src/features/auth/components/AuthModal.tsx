"use client";

import * as React from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AppModalPortal } from "@/components/common/AppModalPortal";
import { useAuthModalStore, type AuthModalView } from "../stores/auth-modal.store";
import { useAuth } from "../hooks/use-auth";
import { GoogleAuthButton } from "./GoogleAuthButton";
import {
  createLoginSchema,
  createRegisterSchema,
  createForgotPasswordSchema,
  createResetPasswordSchema,
  type LoginFormData,
  type RegisterFormData,
  type ForgotPasswordFormData,
  type ResetPasswordFormData,
} from "../schemas/auth.schema";
import { ApiClientError } from "@/lib/api-client";
import { resolvePostLoginRedirect } from "@/lib/safe-redirect";
import { useI18n } from "@/i18n/LocaleProvider";

export function AuthModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t, messages } = useI18n();
  const a = messages.auth;
  const {
    isOpen,
    view,
    emailForOtp,
    verifyToken,
    nextUrl,
    closeAuthModal,
    setView,
    openAuthModal,
  } = useAuthModalStore();

  const {
    login,
    isLoggingIn,
    register: registerUser,
    isRegistering,
    verifyEmail,
    isVerifyingEmail,
    forgotPassword,
    isSubmittingForgotPassword,
    verifyResetOtp,
    isVerifyingResetOtp,
    resetPassword,
    isResettingPassword,
    resendVerificationEmail,
    isResendingVerificationEmail,
  } = useAuth();

  // Email verification state
  const [isEmailVerifySuccess, setIsEmailVerifySuccess] = React.useState(false);
  const [emailVerifyError, setEmailVerifyError] = React.useState<string | null>(null);

  // Listen to URL query params like ?auth=login or ?auth=register or ?auth=verify-email
  React.useEffect(() => {
    const authParam = searchParams.get("auth");
    const nextParam = searchParams.get("next") || undefined;
    const tokenParam = searchParams.get("token") || undefined;
    const errorParam = searchParams.get("error");

    if (
      authParam === "login" ||
      authParam === "register" ||
      authParam === "forgot-password" ||
      authParam === "verify-email"
    ) {
      openAuthModal(authParam as AuthModalView, {
        nextUrl: nextParam,
        token: tokenParam,
      });
      // Strip token from address bar to prevent leaking
      if (tokenParam && typeof window !== "undefined") {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else if (errorParam) {
      openAuthModal("login", { nextUrl: nextParam });
    }
  }, [searchParams, openAuthModal]);

  // View specific state
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isUnverified, setIsUnverified] = React.useState(false);

  // Verification state after registering
  const [pendingRegistration, setPendingRegistration] = React.useState<{
    email: string;
    retryAfter: number;
  } | null>(null);

  // OTP state
  const [otp, setOtp] = React.useState<string[]>(["", "", "", "", "", ""]);
  const [otpCountdown, setOtpCountdown] = React.useState(60);
  const [resetTicket, setResetTicket] = React.useState<string | null>(null);
  const otpInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  // Reset errors and password visibility during render when view changes
  const [prevView, setPrevView] = React.useState(view);
  if (view !== prevView) {
    setPrevView(view);
    setFormError(null);
    setIsUnverified(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setEmailVerifyError(null);
    setIsEmailVerifySuccess(false);
  }

  // Handle email verification from email link
  const onConfirmVerifyEmail = async () => {
    const activeToken = verifyToken || searchParams.get("token");
    if (!activeToken) {
      setEmailVerifyError(a.messages.verifyTokenMissing);
      return;
    }
    setEmailVerifyError(null);
    try {
      await verifyEmail(activeToken);
      setIsEmailVerifySuccess(true);
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        try {
          const channel = new BroadcastChannel("tripgenie_auth_channel");
          channel.postMessage({ type: "EMAIL_VERIFIED" });
          channel.close();
        } catch {
          // ignore
        }
      }
      toast.success(a.messages.accountActivatedWelcome);
      setTimeout(() => {
        closeAuthModal();
        const target = resolvePostLoginRedirect(undefined, nextUrl, "/explore");
        router.push(target);
        router.refresh();
      }, 1200);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : a.messages.verifyLinkInvalid;
      setEmailVerifyError(message);
    }
  };

  // OTP countdown timer
  React.useEffect(() => {
    if (view !== "verify-otp" || otpCountdown <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [view, otpCountdown]);

  // Focus first OTP input
  React.useEffect(() => {
    if (view === "verify-otp") {
      setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
    }
  }, [view]);

  // Handle post login
  const handleLoginSuccess = (role?: string) => {
    toast.success(a.messages.loginSuccess);
    closeAuthModal();
    const target = resolvePostLoginRedirect(role, nextUrl, "/");
    router.push(target);
    router.refresh();
  };

  const loginResolver = React.useMemo(
    () => zodResolver(createLoginSchema(locale)),
    [locale]
  );
  const registerResolver = React.useMemo(
    () => zodResolver(createRegisterSchema(locale)),
    [locale]
  );
  const forgotResolver = React.useMemo(
    () => zodResolver(createForgotPasswordSchema(locale)),
    [locale]
  );
  const resetResolver = React.useMemo(
    () => zodResolver(createResetPasswordSchema(locale)),
    [locale]
  );

  // Login form
  const loginForm = useForm<LoginFormData>({
    resolver: loginResolver,
    defaultValues: { identifier: "", password: "", rememberMe: false },
  });

  const onLoginSubmit = async (data: LoginFormData) => {
    setFormError(null);
    setIsUnverified(false);
    try {
      const res = await login({
        identifier: data.identifier,
        password: data.password,
      });
      handleLoginSuccess(res?.user?.role);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.code === "EMAIL_NOT_VERIFIED") {
        setIsUnverified(true);
        setFormError(a.messages.unverifiedAccount);
        return;
      }
      const message =
        err instanceof Error ? err.message : a.messages.invalidCredentials;
      setFormError(message);
    }
  };

  // Register form
  const registerForm = useForm<RegisterFormData>({
    resolver: registerResolver,
    defaultValues: {
      email: "",
      fullName: "",
      password: "",
      confirmPassword: "",
      agreeTerms: true,
    },
  });

  const onRegisterSubmit = async (data: RegisterFormData) => {
    setFormError(null);
    try {
      const res = await registerUser({
        email: data.email,
        fullName: data.fullName,
        password: data.password,
      });

      setPendingRegistration({
        email: data.email,
        retryAfter: res.retryAfter || 60,
      });
      toast.success(a.messages.registerSuccessCheckEmail);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : a.messages.registerFailed;
      setFormError(message);
    }
  };

  // Forgot password form
  const forgotForm = useForm<ForgotPasswordFormData>({
    resolver: forgotResolver,
    defaultValues: { email: emailForOtp || "" },
  });

  const onForgotSubmit = async (data: ForgotPasswordFormData) => {
    setFormError(null);
    try {
      const res = await forgotPassword({ email: data.email });
      toast.success(a.messages.otpSent);
      setOtp(["", "", "", "", "", ""]);
      setOtpCountdown(res.retryAfter || 60);
      setView("verify-otp", { email: data.email });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : a.messages.otpSendFailed;
      setFormError(message);
    }
  };

  // Handle OTP inputs
  const handleOtpChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, "");
    const nextOtp = [...otp];
    nextOtp[index] = digit ? digit[digit.length - 1] : "";
    setOtp(nextOtp);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const onVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join("");
    if (fullOtp.length !== 6) {
      setFormError(a.messages.otpIncomplete);
      return;
    }
    setFormError(null);
    try {
      const res = await verifyResetOtp({
        email: emailForOtp || "",
        otp: fullOtp,
      });
      toast.success(a.messages.otpVerified);
      setResetTicket(res.resetTicket);
      setView("reset-password");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : a.messages.otpInvalidOrExpired;
      setFormError(message);
    }
  };

  // Reset password form
  const resetForm = useForm<ResetPasswordFormData>({
    resolver: resetResolver,
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onResetSubmit = async (data: ResetPasswordFormData) => {
    if (!resetTicket) {
      setFormError(a.messages.resetSessionExpired);
      setView("forgot-password");
      return;
    }
    setFormError(null);
    try {
      await resetPassword({
        resetTicket,
        password: data.password,
      });
      toast.success(a.messages.resetSuccess);
      setResetTicket(null);
      setView("login");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : a.messages.resetFailed;
      setFormError(message);
    }
  };

  // Header Titles
  const getHeaderInfo = () => {
    switch (view) {
      case "register":
        return {
          title: a.headers.registerTitle,
          subtitle: a.headers.registerSubtitle,
        };
      case "forgot-password":
        return {
          title: a.headers.forgotTitle,
          subtitle: a.headers.forgotSubtitle,
        };
      case "verify-otp":
        return {
          title: a.headers.verifyOtpTitle,
          subtitle: t("auth.headers.verifyOtpSubtitle", {
            email: emailForOtp || a.headers.verifyOtpEmailFallback,
          }),
        };
      case "reset-password":
        return {
          title: a.headers.resetTitle,
          subtitle: a.headers.resetSubtitle,
        };
      case "verify-email":
        return {
          title: a.headers.verifyEmailTitle,
          subtitle: a.headers.verifyEmailSubtitle,
        };
      case "login":
      default:
        return {
          title: a.headers.loginTitle,
          subtitle: a.headers.loginSubtitle,
        };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <AppModalPortal
      open={isOpen}
      onClose={closeAuthModal}
      closeOnBackdropClick={false}
      maxWidthClass="max-w-[440px]"
      mobileBottomSheet={true}
      dialogClassName="border-slate-100 shadow-2xl rounded-t-[28px] sm:rounded-[28px] overflow-hidden"
    >
      <div className="flex flex-col bg-white text-slate-900 font-sans max-h-[88dvh] sm:max-h-[85vh]">
        {/* Mobile drag handle for bottom-sheet gesture affordance */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-12 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Modal Top Bar: Logo + Brand + Close Button */}
        <div className="relative px-6 pt-4 sm:pt-6 pb-3 flex items-center justify-between border-b border-slate-100/80 shrink-0">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo_transparent.png"
              alt="TripGenie Logo"
              width={40}
              height={40}
              style={{ width: "auto", height: "auto" }}
              className="h-9 sm:h-10 w-auto object-contain"
              priority
            />
            <div>
              <span className="text-lg font-black tracking-tight text-slate-900 block leading-tight">
                TripGenie
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block -mt-0.5">
                {t("common.brandTagline")}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={closeAuthModal}
            className="size-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label={a.closePopupAria}
          >
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="px-6 py-5 sm:py-6 overflow-y-auto space-y-5">
          {/* Section Heading */}
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {headerInfo.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
              {headerInfo.subtitle}
            </p>
          </div>

          {/* Error Banner */}
          {formError && (
            <div
              className={`flex items-start gap-3 p-3.5 rounded-xl border text-xs sm:text-sm leading-relaxed ${
                isUnverified
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              <i
                className={`text-base shrink-0 mt-0.5 ${
                  isUnverified
                    ? "fa-solid fa-circle-info text-amber-600"
                    : "fa-solid fa-triangle-exclamation text-rose-600"
                }`}
              />
              <div className="space-y-1">
                <p className="font-medium">{formError}</p>
                {isUnverified && (
                  <button
                    type="button"
                    onClick={() => {
                      const emailVal = loginForm.getValues("identifier");
                      if (emailVal.includes("@")) {
                        resendVerificationEmail(emailVal)
                          .then(() => toast.success(a.messages.verificationResent))
                          .catch((e: Error) => toast.error(e.message));
                      } else {
                        toast.error(a.messages.enterValidEmailForResend);
                      }
                    }}
                    disabled={isResendingVerificationEmail}
                    className="text-xs font-bold text-[#0194F3] hover:underline cursor-pointer inline-flex items-center gap-1.5 pt-1"
                  >
                    {isResendingVerificationEmail ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                        <span>{a.actions.resending}</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane text-xs" />
                        <span>{a.actions.resendVerification}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW: LOGIN                                                  */}
          {/* ============================================================ */}
          {view === "login" && (
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              {/* Identifier */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {a.fields.identifierLabel}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-envelope text-sm" />
                  </span>
                  <input
                    type="text"
                    {...loginForm.register("identifier")}
                    placeholder={a.fields.identifierPlaceholder}
                    className="w-full h-11 sm:h-12 pl-10 pr-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3] focus:border-transparent transition-all"
                    autoComplete="username"
                  />
                </div>
                {loginForm.formState.errors.identifier && (
                  <p className="text-xs text-rose-600 font-medium">
                    {loginForm.formState.errors.identifier.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    {a.fields.passwordLabel}
                  </label>
                  <button
                    type="button"
                    onClick={() => setView("forgot-password")}
                    className="text-xs font-bold text-[#0194F3] hover:underline cursor-pointer"
                  >
                    {a.actions.forgotPassword}
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-lock text-sm" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    {...loginForm.register("password")}
                    placeholder="••••••••"
                    className="w-full h-11 sm:h-12 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3] focus:border-transparent transition-all"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? a.hidePassword : a.showPassword}
                  >
                    <i
                      className={`fa-solid ${
                        showPassword ? "fa-eye-slash" : "fa-eye"
                      } text-sm`}
                    />
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-xs text-rose-600 font-medium">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* Remember Me */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  {...loginForm.register("rememberMe")}
                  className="size-4 rounded text-[#0194F3] focus:ring-[#0194F3] border-slate-300"
                />
                <span className="text-xs sm:text-sm text-slate-600 font-medium">
                  {a.fields.rememberMe}
                </span>
              </label>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full h-11 sm:h-12 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                    <span>{a.actions.signingIn}</span>
                  </>
                ) : (
                  <span>{a.actions.signIn}</span>
                )}
              </button>

              {/* Divider */}
              <div className="relative my-4 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                  {a.or}
                </span>
              </div>

              {/* Google OAuth Button */}
              <GoogleAuthButton label={a.signInWithGoogle} />

              {/* Footer Switch */}
              <p className="text-center text-xs sm:text-sm text-slate-600 font-medium pt-2">
                {a.actions.noAccountYet}{" "}
                <button
                  type="button"
                  onClick={() => setView("register")}
                  className="font-bold text-[#0194F3] hover:underline cursor-pointer"
                >
                  {a.actions.registerNew}
                </button>
              </p>
            </form>
          )}

          {/* ============================================================ */}
          {/* VIEW: REGISTER                                               */}
          {/* ============================================================ */}
          {view === "register" && !pendingRegistration && (
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {a.fields.fullNameLabel}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-user text-sm" />
                  </span>
                  <input
                    type="text"
                    {...registerForm.register("fullName")}
                    placeholder={a.fields.fullNamePlaceholder}
                    className="w-full h-11 sm:h-12 pl-10 pr-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3] focus:border-transparent transition-all"
                  />
                </div>
                {registerForm.formState.errors.fullName && (
                  <p className="text-xs text-rose-600 font-medium">
                    {registerForm.formState.errors.fullName.message}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {a.fields.emailLabel}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-envelope text-sm" />
                  </span>
                  <input
                    type="email"
                    {...registerForm.register("email")}
                    placeholder={a.fields.emailPlaceholder}
                    className="w-full h-11 sm:h-12 pl-10 pr-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3] focus:border-transparent transition-all"
                  />
                </div>
                {registerForm.formState.errors.email && (
                  <p className="text-xs text-rose-600 font-medium">
                    {registerForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {a.fields.passwordLabel}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-lock text-sm" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    {...registerForm.register("password")}
                    placeholder={a.fields.passwordPlaceholder}
                    className="w-full h-11 sm:h-12 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? a.hidePassword : a.showPassword}
                  >
                    <i
                      className={`fa-solid ${
                        showPassword ? "fa-eye-slash" : "fa-eye"
                      } text-sm`}
                    />
                  </button>
                </div>
                {registerForm.formState.errors.password && (
                  <p className="text-xs text-rose-600 font-medium">
                    {registerForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {a.fields.confirmPasswordLabel}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-lock text-sm" />
                  </span>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    {...registerForm.register("confirmPassword")}
                    placeholder={a.fields.confirmPasswordPlaceholder}
                    className="w-full h-11 sm:h-12 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showConfirmPassword ? a.hidePassword : a.showPassword}
                  >
                    <i
                      className={`fa-solid ${
                        showConfirmPassword ? "fa-eye-slash" : "fa-eye"
                      } text-sm`}
                    />
                  </button>
                </div>
                {registerForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-rose-600 font-medium">
                    {registerForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isRegistering}
                className="w-full h-11 sm:h-12 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isRegistering ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                    <span>{a.actions.creatingAccount}</span>
                  </>
                ) : (
                  <span>{a.actions.createFreeAccount}</span>
                )}
              </button>

              {/* Google OAuth */}
              <div className="relative my-3 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                  {a.or}
                </span>
              </div>
              <GoogleAuthButton label={a.signUpWithGoogle} />

              {/* Switch to Login */}
              <p className="text-center text-xs sm:text-sm text-slate-600 font-medium pt-2">
                {a.actions.alreadyHaveAccount}{" "}
                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="font-bold text-[#0194F3] hover:underline cursor-pointer"
                >
                  {a.actions.signInNow}
                </button>
              </p>
            </form>
          )}

          {/* Pending Verification Notice (Post-Register) */}
          {view === "register" && pendingRegistration && (
            <div className="text-center py-4 space-y-4">
              <div className="size-16 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200">
                <i className="fa-solid fa-envelope-circle-check text-2xl" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900">
                  {a.messages.checkInboxTitle}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                  {a.messages.activationLinkSentTo}{" "}
                  <strong className="text-slate-900 font-semibold">
                    {pendingRegistration.email}
                  </strong>
                  . {a.messages.activationLinkInstruction}
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resendVerificationEmail(pendingRegistration.email)
                      .then(() => toast.success(a.messages.activationEmailResent))
                      .catch((e: Error) => toast.error(e.message));
                  }}
                  disabled={isResendingVerificationEmail}
                  className="w-full h-11 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-rotate-right text-xs" />
                  <span>{a.actions.resendActivation}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPendingRegistration(null);
                    setView("login");
                  }}
                  className="text-xs font-bold text-[#0194F3] hover:underline py-2 cursor-pointer"
                >
                  {a.actions.backToLogin}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW: FORGOT PASSWORD                                        */}
          {/* ============================================================ */}
          {view === "forgot-password" && (
            <form onSubmit={forgotForm.handleSubmit(onForgotSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {a.fields.emailLabel}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-envelope text-sm" />
                  </span>
                  <input
                    type="email"
                    {...forgotForm.register("email")}
                    placeholder={a.fields.emailPlaceholder}
                    className="w-full h-11 sm:h-12 pl-10 pr-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3] focus:border-transparent transition-all"
                  />
                </div>
                {forgotForm.formState.errors.email && (
                  <p className="text-xs text-rose-600 font-medium">
                    {forgotForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmittingForgotPassword}
                className="w-full h-11 sm:h-12 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmittingForgotPassword ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                    <span>{a.actions.sendingOtp}</span>
                  </>
                ) : (
                  <span>{a.actions.sendOtp}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setView("login")}
                className="w-full flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 pt-2 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-arrow-left text-xs" />
                <span>{a.actions.backToLogin}</span>
              </button>
            </form>
          )}

          {/* ============================================================ */}
          {/* VIEW: VERIFY OTP                                             */}
          {/* ============================================================ */}
          {view === "verify-otp" && (
            <form onSubmit={onVerifyOtpSubmit} className="space-y-5">
              {/* 6 Digit Inputs */}
              <div className="flex justify-between gap-1.5 sm:gap-2.5">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="size-11 sm:size-12 text-center text-lg sm:text-xl font-bold rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0194F3] focus:border-transparent transition-all"
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>{a.messages.otpNotReceived}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (emailForOtp && otpCountdown <= 0) {
                      forgotPassword({ email: emailForOtp })
                        .then((res) => {
                          toast.success(a.messages.otpNewSent);
                          setOtpCountdown(res.retryAfter || 60);
                          setOtp(["", "", "", "", "", ""]);
                        })
                        .catch((e: Error) => toast.error(e.message));
                    }
                  }}
                  disabled={otpCountdown > 0 || isSubmittingForgotPassword}
                  className="font-bold text-[#0194F3] hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                >
                  <i className="fa-solid fa-rotate-right text-xs" />
                  <span>
                    {otpCountdown > 0
                      ? t("auth.actions.resendAfter", { seconds: otpCountdown })
                      : a.actions.resendCode}
                  </span>
                </button>
              </div>

              <button
                type="submit"
                disabled={isVerifyingResetOtp || otp.join("").length !== 6}
                className="w-full h-11 sm:h-12 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isVerifyingResetOtp ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                    <span>{a.actions.verifyingOtp}</span>
                  </>
                ) : (
                  <span>{a.actions.verifyOtp}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setView("forgot-password")}
                className="w-full flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 pt-1 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-arrow-left text-xs" />
                <span>{a.actions.reenterEmail}</span>
              </button>
            </form>
          )}

          {/* ============================================================ */}
          {/* VIEW: RESET PASSWORD                                         */}
          {/* ============================================================ */}
          {view === "reset-password" && (
            <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {a.fields.newPasswordLabel}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-lock text-sm" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    {...resetForm.register("password")}
                    placeholder={a.fields.passwordPlaceholder}
                    className="w-full h-11 sm:h-12 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? a.hidePassword : a.showPassword}
                  >
                    <i
                      className={`fa-solid ${
                        showPassword ? "fa-eye-slash" : "fa-eye"
                      } text-sm`}
                    />
                  </button>
                </div>
                {resetForm.formState.errors.password && (
                  <p className="text-xs text-rose-600 font-medium">
                    {resetForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {a.fields.confirmNewPasswordLabel}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-lock text-sm" />
                  </span>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    {...resetForm.register("confirmPassword")}
                    placeholder={a.fields.confirmNewPasswordPlaceholder}
                    className="w-full h-11 sm:h-12 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showConfirmPassword ? a.hidePassword : a.showPassword}
                  >
                    <i
                      className={`fa-solid ${
                        showConfirmPassword ? "fa-eye-slash" : "fa-eye"
                      } text-sm`}
                    />
                  </button>
                </div>
                {resetForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-rose-600 font-medium">
                    {resetForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isResettingPassword}
                className="w-full h-11 sm:h-12 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isResettingPassword ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                    <span>{a.actions.updatingPassword}</span>
                  </>
                ) : (
                  <span>{a.actions.saveNewPassword}</span>
                )}
              </button>
            </form>
          )}

          {/* ============================================================ */}
          {/* VIEW: VERIFY EMAIL                                           */}
          {/* ============================================================ */}
          {view === "verify-email" && (
            <div className="space-y-5 text-center py-2">
              {isEmailVerifySuccess ? (
                <div className="space-y-4 animate-in fade-in zoom-in-95">
                  <div className="size-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center text-3xl">
                    <i className="fa-solid fa-circle-check" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900">
                      {a.messages.verifyEmailSuccessTitle}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                      {a.messages.verifyEmailSuccessDesc}
                    </p>
                  </div>
                </div>
              ) : emailVerifyError ? (
                <div className="space-y-4 animate-in fade-in">
                  <div className="size-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 mx-auto flex items-center justify-center text-2xl">
                    <i className="fa-solid fa-triangle-exclamation" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900">
                      {a.messages.verifyEmailErrorTitle}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                      {emailVerifyError}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setView("register")}
                      className="h-11 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                    >
                      {a.actions.registerAgain}
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("login")}
                      className="h-11 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                    >
                      {a.actions.signIn}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 animate-in fade-in">
                  <div className="size-16 rounded-2xl bg-sky-50 text-[#0194F3] border border-blue-200 mx-auto flex items-center justify-center text-2xl">
                    <i className="fa-solid fa-envelope-circle-check" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900">
                      {a.messages.verifyEmailConfirmTitle}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                      {a.messages.verifyEmailConfirmDesc}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={onConfirmVerifyEmail}
                    disabled={isVerifyingEmail}
                    className="w-full h-11 sm:h-12 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isVerifyingEmail ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin text-sm" />
                        <span>{a.actions.activatingAccount}</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-wand-magic-sparkles text-sm" />
                        <span>{a.actions.activateAndContinue}</span>
                      </>
                    )}
                  </button>

                  <p className="text-center text-xs text-slate-500">
                    {a.actions.alreadyVerified}{" "}
                    <button
                      type="button"
                      onClick={() => setView("login")}
                      className="font-bold text-[#0194F3] hover:underline cursor-pointer"
                    >
                      {a.actions.signInNow}
                    </button>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppModalPortal>
  );
}
