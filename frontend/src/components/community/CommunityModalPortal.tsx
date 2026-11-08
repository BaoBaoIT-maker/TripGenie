"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface CommunityModalPortalProps {
  open: boolean;
  onClose: () => void;
  role?: "dialog" | "alertdialog";
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaLabel?: string;
  maxWidthClass?: string;
  dialogClassName?: string;
  disableClose?: boolean;
  children: React.ReactNode;
}

const DESKTOP_VIEWPORT_LOCK_BREAKPOINT = 1024;

export function CommunityModalPortal({
  open,
  onClose,
  role = "dialog",
  ariaLabelledBy,
  ariaDescribedBy,
  ariaLabel,
  maxWidthClass = "max-w-2xl",
  dialogClassName,
  disableClose = false,
  children,
}: CommunityModalPortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    // Only lock body scroll on mobile/tablet where the window itself scrolls.
    // On desktop (>=1024px) /community uses locked 3-column independent scroll,
    // so skipping body style mutation prevents synchronous layout reflow on open.
    const shouldLockBody =
      typeof window !== "undefined" &&
      window.innerWidth < DESKTOP_VIEWPORT_LOCK_BREAKPOINT;

    const prevOverflow = shouldLockBody ? document.body.style.overflow : "";
    if (shouldLockBody) {
      document.body.style.overflow = "hidden";
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disableClose) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      if (shouldLockBody) {
        document.body.style.overflow = prevOverflow;
      }
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, disableClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role={role}
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-label={ariaLabel}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]/60 p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !disableClose) {
          onClose();
        }
      }}
    >
      <div
        className={cn(
          "w-full rounded-[24px] border border-[#E2E8F0] bg-white text-[#0F172A] shadow-[0_20px_40px_rgba(15,23,42,0.22)] overflow-hidden flex flex-col max-h-[90vh]",
          maxWidthClass,
          dialogClassName
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
