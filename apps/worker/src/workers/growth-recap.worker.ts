import { Worker, type Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma, sendAlert } from "@wow/database";
import { QUEUE_NAMES } from "../queues";
import type { PirschService } from "../services/pirsch.service";
import type { OpenRouterService } from "../services/openrouter.service";

interface RecapJobData {
  manual?: boolean;
}

export function createGrowthRecapWorker(
  connection: ConnectionOptions,
  pirsch: PirschService,
  openRouter: OpenRouterService
) {
  return new Worker<RecapJobData>(
    QUEUE_NAMES.GROWTH_RECAP,
    async (_job: Job<RecapJobData>) => {
      console.log("[Growth/Recap] Building daily recap...");

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);

      // Gather all data in parallel
      const [
        todayLogs,
        weekLogs,
        publishedGuides,
        totalGuides,
        draftGuides,
        dailySpend,
      ] = await Promise.all([
        prisma.growthLog.findMany({
          where: { createdAt: { gte: todayStart } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.growthLog.findMany({
          where: { createdAt: { gte: weekStart } },
        }),
        prisma.guide.findMany({
          where: { status: "published" },
          select: {
            title: true,
            slug: true,
            locale: true,
            pageViews: true,
            qualityScore: true,
            publishedAt: true,
            wordCount: true,
          },
          orderBy: { publishedAt: "desc" },
        }),
        prisma.guide.count(),
        prisma.guide.count({ where: { status: "draft" } }),
        openRouter.getDailySpend(),
      ]);

      // Get Pirsch analytics (last 7 days)
      const to = now.toISOString().split("T")[0];
      const from = weekStart.toISOString().split("T")[0];
      let totalVisitors = 0;
      let totalPageViews = 0;
      let guideViews: Array<{ path: string; views: number }> = [];

      if (pirsch.isConfigured()) {
        try {
          const [visitors, pages] = await Promise.all([
            pirsch.getVisitorStats(from, to),
            pirsch.getPageStats(from, to),
          ]);
          totalVisitors = visitors.reduce((sum, v) => sum + v.visitors, 0);
          totalPageViews = visitors.reduce((sum, v) => sum + v.views, 0);
          guideViews = pages
            .filter((p) => p.path.includes("/guides/"))
            .map((p) => ({ path: p.path, views: p.views }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 5);
        } catch { /* Pirsch unavailable */ }
      }

      // Compute stats
      const todayCost = todayLogs.reduce((sum, l) => sum + l.cost, 0);
      const weekCost = weekLogs.reduce((sum, l) => sum + l.cost, 0);
      const todayErrors = todayLogs.filter((l) => l.status === "error").length;
      const todayPublished = todayLogs.filter(
        (l) => l.type === "review" && l.message?.includes("published")
      ).length;
      const publishedEN = publishedGuides.filter((g) => g.locale === "en").length;
      const publishedFR = publishedGuides.filter((g) => g.locale === "fr").length;

      // Build the recap message
      const sections: string[] = [];

      // Header
      sections.push(`📊 Growth Agent — Daily Recap`);
      sections.push(`${now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`);
      sections.push("");

      // Today's activity
      sections.push(`⚡ TODAY`);
      sections.push(`• Actions: ${todayLogs.length} (${todayErrors} errors)`);
      sections.push(`• Published: ${todayPublished} articles`);
      sections.push(`• Cost: $${todayCost.toFixed(4)} (daily budget: $${dailySpend.toFixed(4)} used)`);
      sections.push("");

      // Content inventory
      sections.push(`📝 CONTENT`);
      sections.push(`• Published: ${publishedEN} EN + ${publishedFR} FR = ${publishedEN + publishedFR} articles`);
      sections.push(`• Drafts: ${draftGuides}`);
      sections.push(`• Total: ${totalGuides}`);
      if (publishedGuides.length > 0) {
        const latest = publishedGuides[0];
        sections.push(`• Latest: "${latest.title}" (${latest.qualityScore}/10, ${latest.wordCount}w)`);
      }
      sections.push("");

      // Traffic
      sections.push(`📈 TRAFFIC (7 days)`);
      sections.push(`• Visitors: ${totalVisitors}`);
      sections.push(`• Page views: ${totalPageViews}`);
      if (guideViews.length > 0) {
        sections.push(`• Top guides:`);
        guideViews.forEach((g) => {
          sections.push(`  ${g.path}: ${g.views} views`);
        });
      }
      sections.push("");

      // Week cost
      sections.push(`💰 WEEK COST: $${weekCost.toFixed(4)}`);

      // Errors
      const recentErrors = todayLogs
        .filter((l) => l.status === "error")
        .slice(0, 3);
      if (recentErrors.length > 0) {
        sections.push("");
        sections.push(`⚠️ ERRORS`);
        recentErrors.forEach((e) => {
          sections.push(`• [${e.type}] ${e.message?.slice(0, 100)}`);
        });
      }

      const recap = sections.join("\n");

      await sendAlert({
        title: "Growth Agent Recap",
        message: recap,
        level: "info",
        source: "worker/growth-recap",
        emoji: "📊",
      });

      console.log("[Growth/Recap] Sent daily recap");
    },
    { connection, concurrency: 1 }
  );
}
