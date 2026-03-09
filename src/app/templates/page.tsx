import type { Metadata } from "next";
import DashboardTemplatesLandingPage from "@/feature/dashboard/components/templates/DashboardTemplatesLandingPage";

export const metadata: Metadata = {
  title: "Dashboard Templates for Family, Personal, and Couple Scenarios",
  description:
    "Browse family, personal, and couple dashboard templates and start a new dashboard with example widgets and sample data.",
  keywords: [
    "dashboard templates",
    "family dashboard template",
    "personal dashboard template",
    "couple dashboard template",
  ],
  alternates: {
    canonical: "/templates",
  },
};

export default function TemplatesPage() {
  return <DashboardTemplatesLandingPage />;
}
