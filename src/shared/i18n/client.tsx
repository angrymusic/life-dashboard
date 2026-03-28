"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
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
const LANGUAGE_CHANGE_EVENT = "lifedashboard-language-change";

type I18nProviderProps = {
  children: React.ReactNode;
  initialLanguage: AppLanguage;
};

function writeLanguageCookie(language: AppLanguage) {
  if (typeof document === "undefined") return;
  document.cookie = `${LANGUAGE_COOKIE_KEY}=${language}; path=/; max-age=31536000; samesite=lax`;
}

function getBrowserLanguage() {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  return stored ?? detectLanguageFromNavigator(window.navigator);
}

function subscribeToLanguageChange(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== LANGUAGE_STORAGE_KEY) {
      return;
    }
    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener("languagechange", onStoreChange);
  window.addEventListener(LANGUAGE_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("languagechange", onStoreChange);
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, onStoreChange);
  };
}

export function I18nProvider({ children, initialLanguage }: I18nProviderProps) {
  const language = useSyncExternalStore(
    subscribeToLanguageChange,
    () => getBrowserLanguage() ?? initialLanguage,
    () => initialLanguage
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
    writeLanguageCookie(language);
  }, [language]);

  const setLanguage = useCallback((next: AppLanguage) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
    }
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
