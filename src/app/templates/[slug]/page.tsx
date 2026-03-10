import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DashboardTemplateDetailPage from "@/feature/dashboard/components/templates/DashboardTemplateDetailPage";
import {
  dashboardTemplates,
  getDashboardTemplate,
} from "@/feature/dashboard/libs/dashboardTemplates";
import { SITE_NAME, getAbsoluteUrl } from "@/app/seo";

type TemplatePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  return dashboardTemplates.map((template) => ({ slug: template.slug }));
}

export async function generateMetadata({
  params,
}: TemplatePageProps): Promise<Metadata> {
  const { slug } = await params;
  const template = getDashboardTemplate(slug);

  if (!template) {
    return {};
  }

  const path = `/templates/${template.slug}`;

  return {
    title: template.metaTitle,
    description: template.metaDescription,
    keywords: template.metaKeywords,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: `${template.metaTitle} | ${SITE_NAME}`,
      description: template.metaDescription,
      url: getAbsoluteUrl(path),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${template.metaTitle} | ${SITE_NAME}`,
      description: template.metaDescription,
    },
  };
}

export default async function TemplatePage({ params }: TemplatePageProps) {
  const { slug } = await params;
  const template = getDashboardTemplate(slug);

  if (!template) {
    notFound();
  }

  return <DashboardTemplateDetailPage template={template} />;
}
