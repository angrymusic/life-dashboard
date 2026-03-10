"use client";

import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/shared/i18n/client";
import type { AppLanguage } from "@/shared/i18n/language";
import PwaBootstrap from "./PwaBootstrap";

type ProvidersProps = {
  children: React.ReactNode;
  initialLanguage: AppLanguage;
};

export default function Providers({ children, initialLanguage }: ProvidersProps) {
  return (
    <SessionProvider>
      <I18nProvider initialLanguage={initialLanguage}>
        <PwaBootstrap />
        {children}
      </I18nProvider>
    </SessionProvider>
  );
}
