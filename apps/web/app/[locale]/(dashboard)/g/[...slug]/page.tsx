import { notFound, redirect } from "next/navigation";
import { prisma, Prisma } from "@wow/database";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PublicGuildClient } from "./client";
import { GuildCrest } from "@/components/guild-crest";
import { ShareButton } from "./share-button";
import { SyncStatus } from "./sync-status";
import { ExternalLink } from "lucide-react";
import { guildSlug, guildPath } from "@/lib/guild-url";
import { validateGuildExists } from "@/lib/blizzard";
import {
  enqueueImmediateDiscovery,
  registerGuildSchedules,
} from "@/lib/queue";
import type { Metadata } from "next";

const VALID_REGIONS = ["us", "eu", "kr", "tw", "cn"];

interface Props {
  params: Promise<{ slug: string[]; locale: string }>;
}

async function resolveGuild(slug: string[]) {
  // Old format: /g/{cuid} → redirect to new URL
  if (slug.length === 1) {
    const guild = await prisma.guild.findUnique({
      where: { id: slug[0] },
      select: { name: true, realm: true, region: true },
    });
    if (!guild) return null;
    redirect(guildPath(guild));
  }

  // New format: /g/{region}/{realm}/{guildSlug}
  if (slug.length === 3) {
    const [region, realm, nameSlug] = slug;
    if (!VALID_REGIONS.includes(region)) return null;

    const guildName = decodeURIComponent(nameSlug).replace(/-/g, " ");

    // Look up in DB (case-insensitive name match)
    const guild = await prisma.guild.findFirst({
      where: {
        region,
        realm,
        name: { equals: guildName, mode: "insensitive" },
      },
    });

    if (guild) return guild;

    // Not in DB — auto-scan: validate on Blizzard
    const { exists, crest, name: blizzardName } = await validateGuildExists(
      guildName,
      realm,
      region
    );
    if (!exists) return null;

    const canonicalName = blizzardName || guildName;

    // Create guild (with P2002 race condition handling)
    try {
      const created = await prisma.guild.create({
        data: {
          name: canonicalName,
          realm,
          region,
          crestEmblemId: crest.emblemId,
          crestEmblemColor: crest.emblemColor,
          crestBorderId: crest.borderId,
          crestBorderColor: crest.borderColor,
          crestBgColor: crest.bgColor,
        },
      });

      await registerGuildSchedules(
        created.id,
        created.discoveryIntervalHours,
        created.activeSyncIntervalMin
      );
      await enqueueImmediateDiscovery(created.id);

      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // Another request created it first
        return prisma.guild.findFirst({
          where: {
            region,
            realm,
            name: { equals: canonicalName, mode: "insensitive" },
          },
        });
      }
      throw error;
    }
  }

  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const t = await getTranslations({ locale, namespace: "guildDetail" });

  if (slug.length === 3) {
    const [region, realm, nameSlug] = slug;
    const guildName = decodeURIComponent(nameSlug).replace(/-/g, " ");
    return {
      title: `${guildName} — ${realm} (${region.toUpperCase()})`,
      description: `View ${guildName}'s roster on ${realm}-${region.toUpperCase()}`,
    };
  }

  // For old CUID format, try to resolve
  if (slug.length === 1) {
    const guild = await prisma.guild.findUnique({
      where: { id: slug[0] },
      select: { name: true, realm: true, region: true },
    });
    if (guild) {
      return {
        title: `${guild.name} — ${guild.realm} (${guild.region.toUpperCase()})`,
        description: `View ${guild.name}'s roster on ${guild.realm}-${guild.region.toUpperCase()}`,
      };
    }
  }

  return { title: t("notFound") };
}

export default async function PublicGuildPage({ params }: Props) {
  const { slug, locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("guildDetail");

  const guild = await resolveGuild(slug);
  if (!guild) notFound();

  const members = await prisma.guildMember.findMany({
    where: { guildId: guild.id },
    orderBy: [{ itemLevel: "desc" }, { characterName: "asc" }],
  });

  // Serialize for client component (BigInt -> number, Date -> string)
  const serialized = members.map((m) => ({
    ...m,
    lastLoginTimestamp: m.lastLoginTimestamp
      ? Number(m.lastLoginTimestamp)
      : null,
    lastUpdated: m.lastUpdated.toISOString(),
  }));

  return (
    <div className="w-full px-8 md:px-16 py-10 md:py-12">
      <div className="mb-10 flex items-center gap-5">
        <GuildCrest
          emblemId={guild.crestEmblemId}
          emblemColor={guild.crestEmblemColor}
          borderId={guild.crestBorderId}
          borderColor={guild.crestBorderColor}
          bgColor={guild.crestBgColor}
          size={72}
        />
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">{guild.name}</h1>
            <a
              href={`https://worldofwarcraft.blizzard.com/en-${guild.region}/guild/${guild.region}/${guild.realm}/${guildSlug(guild.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white border border-white/10 hover:border-white/20 transition-all"
            >
              <ExternalLink className="w-3 h-3" />
              Armory
            </a>
            <ShareButton />
          </div>
          <p className="text-gray-500 text-sm font-bold tracking-wide mt-2">
            {guild.realm} — {guild.region.toUpperCase()} · {serialized.length} {t("members")}
          </p>
          <SyncStatus
            guildId={guild.id}
            lastSyncedAt={
              (guild.lastActiveSyncAt && guild.lastDiscoveryAt
                ? guild.lastActiveSyncAt > guild.lastDiscoveryAt
                  ? guild.lastActiveSyncAt
                  : guild.lastDiscoveryAt
                : guild.lastActiveSyncAt || guild.lastDiscoveryAt
              )?.toISOString() ?? null
            }
            syncIntervalMin={guild.activeSyncIntervalMin}
            discoveryIntervalHours={guild.discoveryIntervalHours}
          />
        </div>
      </div>

      <PublicGuildClient members={serialized} region={guild.region} />
    </div>
  );
}
