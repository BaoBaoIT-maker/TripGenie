import { useEffect, useRef, type RefObject } from "react";

/**
 * Module-level modal stack shared by every AppModalPortal instance, so that:
 * - Escape closes only the topmost modal,
 * - body scroll lock is reference-counted (mobile/tablet only),
 * - focus returns to the element that opened the first dialog, not to a removed child.
 */
const DESKTOP_VIEWPORT_LOCK_BREAKPOINT = 1024;
const MODAL_ROOT_SELECTOR = "[data-app-modal]";

interface ModalStackEntry {
  close: () => void;
}

const stack: ModalStackEntry[] = [];
let lockCount = 0;
let previousBodyOverflow = "";
let lastFocusedOutsideModal: HTMLElement | null = null;

function handleFocusIn(event: FocusEvent): void {
  const target = event.target;
  if (target instanceof HTMLElement && !target.closest(MODAL_ROOT_SELECTOR)) {
    lastFocusedOutsideModal = target;
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    stack[stack.length - 1]?.close();
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("focusin", handleFocusIn);
  document.addEventListener("keydown", handleKeyDown);
}

function lockBodyScroll(): boolean {
  if (window.innerWidth >= DESKTOP_VIEWPORT_LOCK_BREAKPOINT) return false;
  if (lockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
  return true;
}

function unlockBodyScroll(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
  }
}

function resolveReturnFocusTarget(): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLElement && !active.closest(MODAL_ROOT_SELECTOR)) {
    return active;
  }
  return lastFocusedOutsideModal;
}

interface UseModalStackOptions {
  open: boolean;
  onClose: () => void;
  disableClose: boolean;
  dialogRef: RefObject<HTMLElement | null>;
}

export function useModalStack({ open, onClose, disableClose, dialogRef }: UseModalStackOptions): void {
  const latest = useRef({ onClose, disableClose });

  useEffect(() => {
    latest.current = { onClose, disableClose };
  });

  useEffect(() => {
    if (!open) return;

    const entry: ModalStackEntry = {
      close: () => {
        if (!latest.current.disableClose) latest.current.onClose();
      },
    };
    const returnFocusTarget = resolveReturnFocusTarget();
    stack.push(entry);
    const locked = lockBodyScroll();

    // Move focus into the dialog unless a child already autofocused.
    const frameId = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (dialog && !dialog.contains(document.activeElement)) {
        dialog.focus({ preventScroll: true });
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      const index = stack.indexOf(entry);
      if (index !== -1) stack.splice(index, 1);
      if (locked) unlockBodyScroll();
      if (returnFocusTarget?.isConnected) {
        returnFocusTarget.focus({ preventScroll: true });
      }
    };
  }, [open, dialogRef]);
}
