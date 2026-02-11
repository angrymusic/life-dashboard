"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  detectLanguageFromNavigator,
  LANGUAGE_COOKIE_KEY,
  LANGUAGE_STORAGE_KEY,
  toLocale,
  type AppLanguage,
  normalizeLanguage,
} from "@/shared/i18n/language";

type I18nContextValue = {
  language: AppLanguage;
  locale: string;
  setLanguage: (next: AppLanguage) => void;
  t: (ko: string, en: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = {
  children: React.ReactNode;
  initialLanguage: AppLanguage;
};

function writeLanguageCookie(language: AppLanguage) {
  if (typeof document === "undefined") return;
  document.cookie = `${LANGUAGE_COOKIE_KEY}=${language}; path=/; max-age=31536000; samesite=lax`;
}

export function I18nProvider({ children, initialLanguage }: I18nProviderProps) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    if (typeof window === "undefined") {
      return initialLanguage;
    }

    const stored = normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
    if (stored) return stored;

    return detectLanguageFromNavigator(window.navigator);
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
    writeLanguageCookie(language);
  }, [language]);

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    }
    writeLanguageCookie(next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      locale: toLocale(language),
      setLanguage,
      t: (ko, en) => (language === "ko" ? ko : en),
    }),
    [language, setLanguage]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider.");
  }
  return context;
}
