"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { LocaleProvider } from "@/i18n";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { ReactNode } from "react";

interface ProvidersProps {
  initialLocale?: Locale;
  children: ReactNode;
}

export function Providers({
  initialLocale = DEFAULT_LOCALE,
  children,
}: ProvidersProps) {
  const queryClient = getQueryClient();

  return (
    <LocaleProvider initialLocale={initialLocale}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </LocaleProvider>
  );
}
