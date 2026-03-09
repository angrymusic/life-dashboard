import type { Metadata } from "next";
import DashboardContainer from "@/feature/dashboard/components/DashboardContainer";
import { getAbsoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "./seo";

const siteUrl = getAbsoluteUrl("/");

export const metadata: Metadata = {
  title: "Life Dashboard - Shared planner for family routines",
  description:
    "Build a shared life dashboard for tasks, notes, photos, weather, and routines. Works for personal planning and family collaboration.",
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/",
      "ko-KR": "/",
    },
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: siteUrl,
  description: SITE_DESCRIPTION,
  inLanguage: ["ko-KR", "en-US"],
};

const webApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: siteUrl,
  description: SITE_DESCRIPTION,
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web",
  browserRequirements: "Requires JavaScript and IndexedDB support",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Drag-and-drop dashboard widgets",
    "Local-first data storage with cloud sync",
    "Calendar, todo, memo, photo, weather, mood, and chart widgets",
    "Shared dashboards and role-based collaboration",
  ],
};

export default function DashboardPage() {
  return (
    <main>
      <h1 className="sr-only">{SITE_NAME}</h1>
      <p className="sr-only">{SITE_DESCRIPTION}</p>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webApplicationJsonLd),
        }}
      />
      <DashboardContainer />
    </main>
  );
}
