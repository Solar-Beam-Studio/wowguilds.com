import { Worker, Queue, type Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma, sendAlert } from "@wow/database";
import { QUEUE_NAMES } from "../queues";
import type { OpenRouterService } from "../services/openrouter.service";
import type { PirschService } from "../services/pirsch.service";
import type { DataAggregationService } from "../services/data-aggregation.service";
import type { GameContextService } from "../services/game-context.service";

interface StrategyJobData {
  manual?: boolean;
}

interface ArticleIdea {
  title: string;
  targetKeyword: string;
  category: string;
  tags: string[];
}

export function createGrowthStrategyWorker(
  connection: ConnectionOptions,
  openRouter: OpenRouterService,
  pirsch: PirschService,
  dataAgg: DataAggregationService,
  gameContext: GameContextService
) {
  const generateQueue = new Queue(QUEUE_NAMES.GROWTH_GENERATE, {
    connection,
  });

  return new Worker<StrategyJobData>(
    QUEUE_NAMES.GROWTH_STRATEGY,
    async (job: Job<StrategyJobData>) => {
      const startTime = Date.now();
      console.log("[Growth/Strategy] Starting weekly content strategy...");

      try {
        // 1. Pull Pirsch analytics (last 7 days)
        const to = new Date().toISOString().split("T")[0];
        const from = new Date(Date.now() - 7 * 86400 * 1000)
          .toISOString()
          .split("T")[0];

        let analyticsContext = "No analytics data available yet.";
        if (pirsch.isConfigured()) {
          try {
            const [pageStats, visitorStats, referrerStats] =
              await Promise.all([
                pirsch.getPageStats(from, to),
                pirsch.getVisitorStats(from, to),
                pirsch.getReferrerStats(from, to),
              ]);
            analyticsContext = JSON.stringify(
              { pageStats: pageStats.slice(0, 20), visitorStats, referrerStats: referrerStats.slice(0, 10) },
              null,
              2
            );
          } catch (e) {
            console.warn("[Growth/Strategy] Pirsch unavailable:", e);
          }
        }

        // 2. Get existing published guides
        const existingGuides = await prisma.guide.findMany({
          where: { status: "published", locale: "en" },
          select: {
            slug: true,
            title: true,
            category: true,
            targetKeyword: true,
            pageViews: true,
            bounceRate: true,
            publishedAt: true,
          },
          orderBy: { pageViews: "desc" },
        });

        // 3. Get current game stats + live game context
        const [overview, classDist, gameCtx] = await Promise.all([
          dataAgg.getOverviewStats(),
          dataAgg.getClassDistribution(),
          gameContext.getCurrentContext(),
        ]);

        // 4. AI generates content plan
        const systemPrompt = `You are a content strategist for wowguilds.com, a World of Warcraft guild lookup and roster tracking tool. Today is ${gameCtx.date}.

${gameContext.formatForPrompt(gameCtx)}

Your goal is to generate SEO content ideas that:
- Target long-tail WoW keywords with low competition
- Use real player data as a unique differentiator (we have actual M+ scores, PvP ratings, item levels, raid progress from tracked guilds)
- Include natural CTAs to the guild lookup tool at wowguilds.com and the /stats page
- Cover categories: m-plus, pvp, raids, general, class-guides
- Reference the CURRENT season/raid/patch specifically (not generic "The War Within" content)
- Don't duplicate existing published content
- Are the kind of content WoW players would actually search for RIGHT NOW

Return a JSON object with this exact structure:
{
  "articles": [
    {
      "title": "Article Title",
      "targetKeyword": "primary keyword phrase",
      "category": "m-plus",
      "tags": ["tag1", "tag2"]
    }
  ],
  "reasoning": "Brief explanation of strategy"
}

Generate 5-7 article ideas.`;

        const userPrompt = `## Current Analytics (last 7 days)
${analyticsContext}

## Existing Published Guides
${existingGuides.length > 0 ? JSON.stringify(existingGuides, null, 2) : "None yet — this is our first batch."}

## Live Game Data
- ${overview.totalGuilds} guilds tracked, ${overview.totalMembers} characters (${overview.activeMembers} active)
- Average item level: ${overview.avgItemLevel}, Average M+ score: ${overview.avgMythicPlusScore}
- Class distribution: ${classDist.map((c) => `${c.characterClass}: ${c.count} (avg M+ ${c.avgMythicPlusScore})`).join(", ")}

Generate a content plan for this week.`;

        const result = await openRouter.complete(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          { jsonMode: true, temperature: 0.8 }
        );

        let plan: { articles: ArticleIdea[]; reasoning: string };
        try {
          plan = JSON.parse(result.content);
        } catch {
          throw new Error(
            `Failed to parse AI response as JSON: ${result.content.slice(0, 200)}`
          );
        }

        if (!plan.articles?.length) {
          throw new Error("AI returned empty articles list");
        }

        // 5. Create ContentPlan record
        const weekOf = new Date();
        weekOf.setHours(0, 0, 0, 0);
        weekOf.setDate(weekOf.getDate() - weekOf.getDay() + 1); // Monday

        const contentPlan = await prisma.contentPlan.create({
          data: {
            weekOf,
            status: "in_progress",
            strategy: JSON.stringify(plan),
            totalBudgetUsed: result.cost,
          },
        });

        // 6. Enqueue generation jobs
        for (const article of plan.articles) {
          await generateQueue.add(
            `generate:${article.targetKeyword}`,
            {
              title: article.title,
              targetKeyword: article.targetKeyword,
              category: article.category,
              tags: article.tags,
              locale: "en",
              contentPlanId: contentPlan.id,
            },
            {
              delay: 0,
              attempts: 2,
              backoff: { type: "exponential", delay: 60000 },
            }
          );
        }

        // 7. Log
        const duration = Math.round((Date.now() - startTime) / 1000);
        await prisma.growthLog.create({
          data: {
            type: "strategy",
            status: "success",
            message: `Generated plan with ${plan.articles.length} articles. Reasoning: ${plan.reasoning}`,
            metadata: { planId: contentPlan.id, articleCount: plan.articles.length, model: result.model },
            cost: result.cost,
            duration,
          },
        });

        await sendAlert({
          title: "Growth Strategy Complete",
          message: `Planned ${plan.articles.length} articles for this week.\n\n${plan.articles.map((a, i) => `${i + 1}. ${a.title} [${a.category}]`).join("\n")}\n\nReasoning: ${plan.reasoning}\nCost: $${result.cost.toFixed(4)}`,
          level: "success",
          source: "worker/growth-strategy",
          emoji: "🧠",
        });

        console.log(
          `[Growth/Strategy] Plan created: ${plan.articles.length} articles (${duration}s, $${result.cost.toFixed(4)})`
        );
      } catch (error) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        const msg =
          error instanceof Error ? error.message : String(error);
        await prisma.growthLog.create({
          data: {
            type: "strategy",
            status: "error",
            message: msg.slice(0, 500),
            duration,
          },
        });
        console.error("[Growth/Strategy] Failed:", msg);
        throw error;
      }
    },
    { connection, concurrency: 1 }
  );
}
