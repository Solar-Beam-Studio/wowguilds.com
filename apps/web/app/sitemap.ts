import type { MetadataRoute } from "next";
import { prisma } from "@wow/database";
import { guildPath } from "@/lib/guild-url";

export const dynamic = "force-dynamic";

const BASE_URL = "https://wowguilds.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
      alternates: { languages: { en: BASE_URL, fr: `${BASE_URL}/fr` } },
    },
    {
      url: `${BASE_URL}/faq`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
      alternates: { languages: { en: `${BASE_URL}/faq`, fr: `${BASE_URL}/fr/faq` } },
    },
  ];

  const guilds = await prisma.guild.findMany({
    select: { name: true, realm: true, region: true, updatedAt: true },
  });

  const guildEntries: MetadataRoute.Sitemap = guilds.map((guild) => {
    const path = guildPath(guild);
    return {
      url: `${BASE_URL}${path}`,
      lastModified: guild.updatedAt,
      changeFrequency: "daily",
      priority: 0.8,
      alternates: {
        languages: {
          en: `${BASE_URL}${path}`,
          fr: `${BASE_URL}/fr${path}`,
        },
      },
    };
  });

  const guides = await prisma.guide.findMany({
    where: { status: "published", locale: "en" },
    select: { slug: true, updatedAt: true },
  });

  const guideEntries: MetadataRoute.Sitemap = [
    // Guides index
    {
      url: `${BASE_URL}/guides`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
      alternates: {
        languages: {
          en: `${BASE_URL}/guides`,
          fr: `${BASE_URL}/fr/guides`,
        },
      },
    },
    // Individual guides
    ...guides.map((guide) => ({
      url: `${BASE_URL}/guides/${guide.slug}`,
      lastModified: guide.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      alternates: {
        languages: {
          en: `${BASE_URL}/guides/${guide.slug}`,
          fr: `${BASE_URL}/fr/guides/${guide.slug}`,
        },
      },
    })),
  ];

  return [...staticEntries, ...guildEntries, ...guideEntries];
}
