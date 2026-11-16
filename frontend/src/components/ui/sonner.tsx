"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton={true}
      duration={2500}
      swipeDirections={["top", "right", "left", "bottom"]}
      visibleToasts={3}
      gap={8}
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !cursor-grab active:!cursor-grabbing select-none",
          actionButton: "!bg-[#0194F3] hover:!bg-[#007AD0] !text-white !font-bold !text-xs !rounded-lg !px-2.5 !py-1",
          closeButton: "!bg-white hover:!bg-slate-100 !text-slate-600 hover:!text-slate-900 !border-slate-200 !size-5 !rounded-full !shadow-xs",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
