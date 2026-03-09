import type { MetadataRoute } from "next";
import { dashboardTemplates } from "@/feature/dashboard/libs/dashboardTemplates";
import { getSiteUrl } from "./seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const siteOrigin = siteUrl.origin;

  return [
    {
      url: `${siteOrigin}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteOrigin}/templates`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    ...dashboardTemplates.map((template) => ({
      url: `${siteOrigin}/templates/${template.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
