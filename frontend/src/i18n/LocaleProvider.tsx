'use client';

import * as React from 'react';
import {
  DEFAULT_LOCALE,
  setActiveClientLocale,
  writeClientLocaleCookie,
  type Locale,
} from './config';
import {
  getMessages,
  translate,
  type Messages,
  type TranslationKey,
  type TranslationParams,
} from './core';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  messages: Messages;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const FALLBACK_CONTEXT_VALUE: I18nContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  toggleLocale: () => {},
  messages: getMessages(DEFAULT_LOCALE),
  t: (key, params) => translate(DEFAULT_LOCALE, key, params),
};

const LocaleContext = React.createContext<I18nContextValue>(FALLBACK_CONTEXT_VALUE);

interface LocaleProviderProps {
  initialLocale?: Locale;
  children: React.ReactNode;
}

export function LocaleProvider({
  initialLocale = DEFAULT_LOCALE,
  children,
}: LocaleProviderProps) {
  const [locale, setLocaleState] = React.useState<Locale>(() => {
    setActiveClientLocale(initialLocale);
    return initialLocale;
  });

  React.useEffect(() => {
    setActiveClientLocale(locale);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = React.useCallback((nextLocale: Locale) => {
    setActiveClientLocale(nextLocale);
    writeClientLocaleCookie(nextLocale);
    setLocaleState(nextLocale);
  }, []);

  const toggleLocale = React.useCallback(() => {
    setLocale(locale === 'vi' ? 'en' : 'vi');
  }, [locale, setLocale]);

  const value = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      messages: getMessages(locale),
      t: (key, params) => translate(locale, key, params),
    }),
    [locale, setLocale, toggleLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return React.useContext(LocaleContext);
}
