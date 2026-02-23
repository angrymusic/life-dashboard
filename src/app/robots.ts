import type { MetadataRoute } from "next";
import { getSiteUrl } from "./seo";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  const siteOrigin = siteUrl.origin;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${siteOrigin}/sitemap.xml`,
    host: siteOrigin,
  };
}
