import Redis from "ioredis";

const TOKEN_KEY = "blizzard:oauth:token";
const TOKEN_TTL = 55 * 60; // 55 minutes

let redis: Redis | null = null;

function getRedis() {
  if (!redis) {
    redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
    });
  }
  return redis;
}

export async function getBlizzardToken(): Promise<string> {
  const r = getRedis();
  const cached = await r.get(TOKEN_KEY);
  if (cached) return cached;

  const clientId = process.env.BLIZZARD_CLIENT_ID;
  const clientSecret = process.env.BLIZZARD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing BLIZZARD_CLIENT_ID or BLIZZARD_CLIENT_SECRET");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch("https://oauth.battle.net/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Blizzard OAuth failed: ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string };
  await r.set(TOKEN_KEY, data.access_token, "EX", TOKEN_TTL);
  return data.access_token;
}

const VALID_REGIONS = ["us", "eu", "kr", "tw", "cn"];

export async function fetchRealms(region: string): Promise<{ name: string; slug: string }[]> {
  if (!VALID_REGIONS.includes(region)) return [];

  const r = getRedis();
  const cacheKey = `blizzard:realms:${region}`;
  const cached = await r.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const token = await getBlizzardToken();
  const url = `https://${region}.api.blizzard.com/data/wow/realm/index?namespace=dynamic-${region}&locale=en_US`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return [];

  const data = (await response.json()) as { realms: { name: string; slug: string }[] };
  const realms = data.realms.map((r) => ({ name: r.name, slug: r.slug })).sort((a, b) => a.name.localeCompare(b.name));

  // Cache for 24h — realms don't change
  await r.set(cacheKey, JSON.stringify(realms), "EX", 86400);
  return realms;
}

export async function validateGuildExists(
  guildName: string,
  realm: string,
  region: string
): Promise<boolean> {
  if (!VALID_REGIONS.includes(region)) return false;

  const token = await getBlizzardToken();
  const slug = encodeURIComponent(guildName.toLowerCase().replace(/\s+/g, "-"));
  const realmSlug = encodeURIComponent(realm.toLowerCase());

  const url = `https://${region}.api.blizzard.com/data/wow/guild/${realmSlug}/${slug}?namespace=profile-${region}&locale=en_US`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.ok;
}
