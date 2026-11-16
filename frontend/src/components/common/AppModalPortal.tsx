"use client";

import { useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useModalStack } from "./use-modal-stack";

export interface AppModalPortalProps {
  open: boolean;
  onClose: () => void;
  role?: "dialog" | "alertdialog";
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaLabel?: string;
  maxWidthClass?: string;
  dialogClassName?: string;
  disableClose?: boolean;
  /** Render bottom-aligned sheet on mobile viewports (<640px), centered dialog on sm+. */
  mobileBottomSheet?: boolean;
  children: React.ReactNode;
}

const noopSubscribe = () => () => {};

export function AppModalPortal({
  open,
  onClose,
  role = "dialog",
  ariaLabelledBy,
  ariaDescribedBy,
  ariaLabel,
  maxWidthClass = "max-w-2xl",
  dialogClassName,
  disableClose = false,
  mobileBottomSheet = false,
  children,
}: AppModalPortalProps) {
  // True on the client, false during SSR/hydration: portals need document.body.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useModalStack({ open, onClose, disableClose, dialogRef });

  if (!open || !isClient) return null;

  return createPortal(
    <div
      role={role}
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      aria-label={ariaLabel}
      data-app-modal=""
      className={cn(
        "fixed inset-0 z-[100] flex justify-center bg-[#0F172A]/60",
        mobileBottomSheet
          ? "items-end sm:items-center p-0 sm:p-4"
          : "items-center p-3 sm:p-4",
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget && !disableClose) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          "w-full border border-[#E2E8F0] bg-white text-[#0F172A] shadow-[0_20px_40px_rgba(15,23,42,0.22)] overflow-hidden flex flex-col max-h-[90vh] outline-none",
          mobileBottomSheet ? "rounded-t-[24px] sm:rounded-[24px]" : "rounded-[24px]",
          maxWidthClass,
          dialogClassName,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
