import type Redis from "ioredis";

const TOKEN_KEY = "blizzard:oauth:token";
const TOKEN_LOCK_KEY = "blizzard:oauth:lock";
const TOKEN_TTL = 55 * 60; // 55 minutes (tokens expire after 60)
const LOCK_TTL = 10; // 10 seconds

export class BlizzardTokenService {
  constructor(private redis: Redis) {}

  async getToken(): Promise<string> {
    const cached = await this.redis.get(TOKEN_KEY);
    if (cached) return cached;
    return this.refreshToken();
  }

  async invalidateToken(): Promise<void> {
    await this.redis.del(TOKEN_KEY);
  }

  private async refreshToken(): Promise<string> {
    // Acquire lock to prevent thundering herd
    const lockAcquired = await this.redis.set(
      TOKEN_LOCK_KEY,
      "1",
      "EX",
      LOCK_TTL,
      "NX"
    );

    if (!lockAcquired) {
      // Another worker is refreshing, wait and retry
      await new Promise((r) => setTimeout(r, 2000));
      const cached = await this.redis.get(TOKEN_KEY);
      if (cached) return cached;
      // If still no token, force refresh
    }

    try {
      const clientId = process.env.BLIZZARD_CLIENT_ID;
      const clientSecret = process.env.BLIZZARD_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        throw new Error("Missing BLIZZARD_CLIENT_ID or BLIZZARD_CLIENT_SECRET");
      }

      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
        "base64"
      );

      const response = await fetch("https://oauth.battle.net/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });

      if (!response.ok) {
        throw new Error(
          `Blizzard OAuth failed: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as { access_token: string };
      const token = data.access_token;

      await this.redis.set(TOKEN_KEY, token, "EX", TOKEN_TTL);
      console.log("[BlizzardToken] Token refreshed and cached");

      return token;
    } finally {
      await this.redis.del(TOKEN_LOCK_KEY);
    }
  }
}
