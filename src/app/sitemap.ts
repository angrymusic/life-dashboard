import type { MetadataRoute } from "next";
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
  ];
}
