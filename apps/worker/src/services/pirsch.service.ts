import type Redis from "ioredis";

interface PageStat {
  path: string;
  visitors: number;
  views: number;
  bounceRate: number;
}

interface VisitorStat {
  day: string;
  visitors: number;
  views: number;
}

interface ReferrerStat {
  referrer: string;
  visitors: number;
}

const TOKEN_KEY = "pirsch:access_token";
const TOKEN_TTL = 1500; // 25 minutes

export class PirschService {
  private clientId: string;
  private clientSecret: string;
  private domainId: string;

  constructor(private redis: Redis) {
    this.clientId = process.env.PIRSCH_CLIENT_ID || "";
    this.clientSecret = process.env.PIRSCH_CLIENT_SECRET || "";
    this.domainId = process.env.PIRSCH_DOMAIN_ID || "";
  }

  private async getAccessToken(): Promise<string> {
    const cached = await this.redis.get(TOKEN_KEY);
    if (cached) return cached;

    if (!this.clientId || !this.clientSecret) {
      throw new Error("PIRSCH_CLIENT_ID / PIRSCH_CLIENT_SECRET not set");
    }

    const res = await fetch("https://api.pirsch.io/api/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!res.ok) {
      throw new Error(`Pirsch token error: ${res.status}`);
    }

    const { access_token } = await res.json();
    await this.redis.setex(TOKEN_KEY, TOKEN_TTL, access_token);
    return access_token;
  }

  private async apiGet(path: string, params: Record<string, string>) {
    const token = await this.getAccessToken();
    const qs = new URLSearchParams({
      id: this.domainId,
      ...params,
    });
    const res = await fetch(`https://api.pirsch.io/api/v1${path}?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Pirsch API ${res.status}: ${await res.text().catch(() => "")}`);
    }
    return res.json();
  }

  async getPageStats(from: string, to: string): Promise<PageStat[]> {
    const data = await this.apiGet("/statistics/page", { from, to });
    return (data || []).map((p: Record<string, unknown>) => ({
      path: p.path as string,
      visitors: (p.visitors as number) || 0,
      views: (p.views as number) || 0,
      bounceRate: (p.bounce_rate as number) || 0,
    }));
  }

  async getVisitorStats(from: string, to: string): Promise<VisitorStat[]> {
    const data = await this.apiGet("/statistics/visitor", { from, to });
    return (data || []).map((v: Record<string, unknown>) => ({
      day: v.day as string,
      visitors: (v.visitors as number) || 0,
      views: (v.views as number) || 0,
    }));
  }

  async getReferrerStats(from: string, to: string): Promise<ReferrerStat[]> {
    const data = await this.apiGet("/statistics/referrer", { from, to });
    return (data || []).map((r: Record<string, unknown>) => ({
      referrer: (r.referrer as string) || "direct",
      visitors: (r.visitors as number) || 0,
    }));
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.domainId);
  }
}
