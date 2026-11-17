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
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type LoginFormData,
  type RegisterFormData,
  type ForgotPasswordFormData,
  type ResetPasswordFormData,
} from "../schemas/auth.schema";
import { ApiClientError } from "@/lib/api-client";
import { resolvePostLoginRedirect } from "@/lib/safe-redirect";

export function AuthModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Reset errors and password visibility when view changes
  React.useEffect(() => {
    setFormError(null);
    setIsUnverified(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setEmailVerifyError(null);
    setIsEmailVerifySuccess(false);
  }, [view]);

  // Handle email verification from email link
  const onConfirmVerifyEmail = async () => {
    const activeToken = verifyToken || searchParams.get("token");
    if (!activeToken) {
      setEmailVerifyError("Không tìm thấy mã xác thực hoặc liên kết đã hết hạn.");
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
      toast.success("Kích hoạt tài khoản thành công! Chào mừng bạn đến với TripGenie.");
      setTimeout(() => {
        closeAuthModal();
        const target = resolvePostLoginRedirect(undefined, nextUrl, "/explore");
        router.push(target);
        router.refresh();
      }, 1200);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Liên kết xác thực không hợp lệ hoặc đã hết hạn (quá 30 phút). Vui lòng thử đăng ký lại.";
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
    toast.success("Đăng nhập thành công!");
    closeAuthModal();
    const target = resolvePostLoginRedirect(role, nextUrl, "/");
    router.push(target);
    router.refresh();
  };

  // Login form
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
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
        setFormError(
          "Tài khoản chưa được kích hoạt qua email. Vui lòng kiểm tra hộp thư đến để nhấn vào liên kết xác thực."
        );
        return;
      }
      const message =
        err instanceof Error
          ? err.message
          : "Tài khoản/email hoặc mật khẩu không chính xác";
      setFormError(message);
    }
  };

  // Register form
  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
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
      toast.success(
        res.message || "Đăng ký thành công! Vui lòng kiểm tra email để kích hoạt."
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Đăng ký không thành công. Vui lòng thử lại.";
      setFormError(message);
    }
  };

  // Forgot password form
  const forgotForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: emailForOtp || "" },
  });

  const onForgotSubmit = async (data: ForgotPasswordFormData) => {
    setFormError(null);
    try {
      const res = await forgotPassword({ email: data.email });
      toast.success(res.message || "Mã OTP đã được gửi đến email của bạn!");
      setOtp(["", "", "", "", "", ""]);
      setOtpCountdown(res.retryAfter || 60);
      setView("verify-otp", { email: data.email });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Không thể gửi OTP. Vui lòng thử lại sau.";
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
      setFormError("Vui lòng nhập đầy đủ mã OTP 6 chữ số");
      return;
    }
    setFormError(null);
    try {
      const res = await verifyResetOtp({
        email: emailForOtp || "",
        otp: fullOtp,
      });
      toast.success("Xác thực OTP thành công!");
      setResetTicket(res.resetTicket);
      setView("reset-password");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Mã OTP không chính xác hoặc đã hết hạn";
      setFormError(message);
    }
  };

  // Reset password form
  const resetForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onResetSubmit = async (data: ResetPasswordFormData) => {
    if (!resetTicket) {
      setFormError("Phiên xác thực đã hết hạn. Vui lòng gửi lại yêu cầu OTP.");
      setView("forgot-password");
      return;
    }
    setFormError(null);
    try {
      await resetPassword({
        resetTicket,
        password: data.password,
      });
      toast.success("Đặt lại mật khẩu thành công! Vui lòng đăng nhập.");
      setResetTicket(null);
      setView("login");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Không thể đặt lại mật khẩu. Vui lòng thử lại.";
      setFormError(message);
    }
  };

  // Header Titles
  const getHeaderInfo = () => {
    switch (view) {
      case "register":
        return {
          title: "Tạo tài khoản TripGenie",
          subtitle: "Khám phá và thiết kế chuyến đi thông minh cùng cộng đồng",
        };
      case "forgot-password":
        return {
          title: "Quên mật khẩu",
          subtitle: "Nhập email đã đăng ký để nhận mã OTP khôi phục tài khoản",
        };
      case "verify-otp":
        return {
          title: "Xác thực mã OTP",
          subtitle: `Mã xác nhận 6 số đã được gửi tới ${emailForOtp || "email của bạn"}`,
        };
      case "reset-password":
        return {
          title: "Đặt mật khẩu mới",
          subtitle: "Tạo mật khẩu an toàn và tiếp tục hành trình cùng TripGenie",
        };
      case "verify-email":
        return {
          title: "Kích hoạt tài khoản",
          subtitle: "Xác thực quyền sở hữu email để hoàn tất kích hoạt tài khoản TripGenie",
        };
      case "login":
      default:
        return {
          title: "Chào mừng bạn trở lại",
          subtitle: "Đăng nhập để đồng bộ lịch trình và tương tác cùng hội bạn",
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
                Nền tảng du lịch thông minh
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={closeAuthModal}
            className="size-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Đóng popup"
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
                          .then(() => toast.success("Đã gửi lại liên kết kích hoạt tới email!"))
                          .catch((e: Error) => toast.error(e.message));
                      } else {
                        toast.error("Vui lòng nhập email hợp lệ để gửi lại liên kết.");
                      }
                    }}
                    disabled={isResendingVerificationEmail}
                    className="text-xs font-bold text-[#0194F3] hover:underline cursor-pointer inline-flex items-center gap-1.5 pt-1"
                  >
                    {isResendingVerificationEmail ? (
                      <>
                        <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                        <span>Đang gửi lại...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane text-xs" />
                        <span>Gửi lại email xác thực</span>
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
                  Email hoặc Tên đăng nhập
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-envelope text-sm" />
                  </span>
                  <input
                    type="text"
                    {...loginForm.register("identifier")}
                    placeholder="name@example.com hoặc username"
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
                    Mật khẩu
                  </label>
                  <button
                    type="button"
                    onClick={() => setView("forgot-password")}
                    className="text-xs font-bold text-[#0194F3] hover:underline cursor-pointer"
                  >
                    Quên mật khẩu?
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
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
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
                  Ghi nhớ đăng nhập trên thiết bị này
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
                    <span>Đang đăng nhập...</span>
                  </>
                ) : (
                  <span>Đăng nhập</span>
                )}
              </button>

              {/* Divider */}
              <div className="relative my-4 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Hoặc
                </span>
              </div>

              {/* Google OAuth Button */}
              <GoogleAuthButton label="Đăng nhập với Google" />

              {/* Footer Switch */}
              <p className="text-center text-xs sm:text-sm text-slate-600 font-medium pt-2">
                Chưa có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => setView("register")}
                  className="font-bold text-[#0194F3] hover:underline cursor-pointer"
                >
                  Tạo tài khoản mới
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
                  Họ và tên
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-user text-sm" />
                  </span>
                  <input
                    type="text"
                    {...registerForm.register("fullName")}
                    placeholder="Nguyễn Văn A"
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
                  Địa chỉ Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-envelope text-sm" />
                  </span>
                  <input
                    type="email"
                    {...registerForm.register("email")}
                    placeholder="name@example.com"
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
                  Mật khẩu
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-lock text-sm" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    {...registerForm.register("password")}
                    placeholder="Tối thiểu 8 ký tự"
                    className="w-full h-11 sm:h-12 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
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
                  Xác nhận mật khẩu
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-lock text-sm" />
                  </span>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    {...registerForm.register("confirmPassword")}
                    placeholder="Nhập lại mật khẩu"
                    className="w-full h-11 sm:h-12 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
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
                    <span>Đang đăng ký...</span>
                  </>
                ) : (
                  <span>Tạo tài khoản miễn phí</span>
                )}
              </button>

              {/* Google OAuth */}
              <div className="relative my-3 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Hoặc
                </span>
              </div>
              <GoogleAuthButton label="Đăng ký với Google" />

              {/* Switch to Login */}
              <p className="text-center text-xs sm:text-sm text-slate-600 font-medium pt-2">
                Đã có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => setView("login")}
                  className="font-bold text-[#0194F3] hover:underline cursor-pointer"
                >
                  Đăng nhập ngay
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
                  Kiểm tra hộp thư đến của bạn
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                  Chúng tôi đã gửi liên kết kích hoạt đến{" "}
                  <strong className="text-slate-900 font-semibold">
                    {pendingRegistration.email}
                  </strong>
                  . Vui lòng bấm vào liên kết trong thư để hoàn tất.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resendVerificationEmail(pendingRegistration.email)
                      .then(() => toast.success("Đã gửi lại email kích hoạt!"))
                      .catch((e: Error) => toast.error(e.message));
                  }}
                  disabled={isResendingVerificationEmail}
                  className="w-full h-11 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-rotate-right text-xs" />
                  <span>Gửi lại email kích hoạt</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPendingRegistration(null);
                    setView("login");
                  }}
                  className="text-xs font-bold text-[#0194F3] hover:underline py-2 cursor-pointer"
                >
                  Quay lại đăng nhập
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
                  Địa chỉ Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-envelope text-sm" />
                  </span>
                  <input
                    type="email"
                    {...forgotForm.register("email")}
                    placeholder="name@example.com"
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
                    <span>Đang gửi mã OTP...</span>
                  </>
                ) : (
                  <span>Gửi mã xác nhận OTP</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setView("login")}
                className="w-full flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 pt-2 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-arrow-left text-xs" />
                <span>Quay lại đăng nhập</span>
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
                <span>Không nhận được mã?</span>
                <button
                  type="button"
                  onClick={() => {
                    if (emailForOtp && otpCountdown <= 0) {
                      forgotPassword({ email: emailForOtp })
                        .then((res) => {
                          toast.success("Mã OTP mới đã được gửi!");
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
                    {otpCountdown > 0 ? `Gửi lại sau ${otpCountdown}s` : "Gửi lại mã"}
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
                    <span>Đang xác thực...</span>
                  </>
                ) : (
                  <span>Xác nhận mã OTP</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setView("forgot-password")}
                className="w-full flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 pt-1 transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-arrow-left text-xs" />
                <span>Nhập lại địa chỉ email</span>
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
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-lock text-sm" />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    {...resetForm.register("password")}
                    placeholder="Tối thiểu 8 ký tự"
                    className="w-full h-11 sm:h-12 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
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
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i className="fa-solid fa-lock text-sm" />
                  </span>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    {...resetForm.register("confirmPassword")}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full h-11 sm:h-12 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0194F3] focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
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
                    <span>Đang cập nhật mật khẩu...</span>
                  </>
                ) : (
                  <span>Lưu mật khẩu mới</span>
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
                      Kích hoạt tài khoản thành công!
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                      Chào mừng bạn gia nhập TripGenie. Đang đưa bạn đến bảng khám phá địa điểm du lịch...
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
                      Không thể kích hoạt tài khoản
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
                      Đăng ký lại
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("login")}
                      className="h-11 rounded-xl bg-[#0194F3] hover:bg-[#0084DE] text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                    >
                      Đăng nhập
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
                      Xác nhận kích hoạt tài khoản
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                      Nhấn vào nút bên dưới để hoàn tất việc xác thực địa chỉ email và đăng nhập vào TripGenie.
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
                        <span>Đang kích hoạt tài khoản...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-wand-magic-sparkles text-sm" />
                        <span>Kích hoạt và tiếp tục</span>
                      </>
                    )}
                  </button>

                  <p className="text-center text-xs text-slate-500">
                    Đã kích hoạt trước đó?{" "}
                    <button
                      type="button"
                      onClick={() => setView("login")}
                      className="font-bold text-[#0194F3] hover:underline cursor-pointer"
                    >
                      Đăng nhập ngay
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
