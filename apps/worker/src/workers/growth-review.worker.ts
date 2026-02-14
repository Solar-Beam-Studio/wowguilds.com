import { Worker, Queue, type Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma, Prisma, sendAlert } from "@wow/database";
import { QUEUE_NAMES } from "../queues";
import type { OpenRouterService } from "../services/openrouter.service";
import type { IndexNowService } from "../services/indexnow.service";

interface ReviewJobData {
  guideId: string;
}

interface ReviewResult {
  overall: number;
  seo: number;
  accuracy: number;
  readability: number;
  issues: string[];
}

export function createGrowthReviewWorker(
  connection: ConnectionOptions,
  openRouter: OpenRouterService,
  indexNow: IndexNowService
) {
  const generateQueue = new Queue(QUEUE_NAMES.GROWTH_GENERATE, {
    connection,
  });

  return new Worker<ReviewJobData>(
    QUEUE_NAMES.GROWTH_REVIEW,
    async (job: Job<ReviewJobData>) => {
      const { guideId } = job.data;
      const startTime = Date.now();

      console.log(`[Growth/Review] Reviewing guide ${guideId}`);

      try {
        const guide = await prisma.guide.findUnique({
          where: { id: guideId },
        });
        if (!guide) throw new Error(`Guide ${guideId} not found`);

        const result = await openRouter.complete(
          [
            {
              role: "system",
              content: `You are a content quality reviewer for a World of Warcraft website. Review the article and score it.

Return JSON with this exact structure:
{
  "overall": 8,
  "seo": 7,
  "accuracy": 9,
  "readability": 8,
  "issues": ["issue 1", "issue 2"]
}

Scoring criteria (0-10):
- overall: General quality, would a WoW player find this useful?
- seo: Does it target the keyword naturally? Good headings? Good length (1200-2000 words)?
- accuracy: Are WoW game mechanics/terminology correct?
- readability: Is it well-structured, scannable, and engaging?

Be strict but fair. 7+ means publishable quality.`,
            },
            {
              role: "user",
              content: `Title: ${guide.title}
Target Keyword: ${guide.targetKeyword}
Category: ${guide.category}
Word Count: ${guide.wordCount}
Locale: ${guide.locale}

---

${guide.content}`,
            },
          ],
          { jsonMode: true, temperature: 0.3, maxTokens: 512 }
        );

        let review: ReviewResult;
        try {
          review = JSON.parse(result.content);
        } catch {
          throw new Error(
            `Failed to parse review JSON: ${result.content.slice(0, 200)}`
          );
        }

        const score = review.overall;

        if (score >= 7) {
          // Publish
          await prisma.guide.update({
            where: { id: guideId },
            data: {
              status: "published",
              qualityScore: score,
              publishedAt: new Date(),
            },
          });
          // Ping search engines + notify
          indexNow.submitGuide(guide.slug, guide.locale).catch(() => {});
          const prefix = guide.locale === "en" ? "" : `/${guide.locale}`;
          await sendAlert({
            title: "Article Published",
            message: `"${guide.title}" (${guide.locale.toUpperCase()}) — Score: ${score}/10, ${guide.wordCount} words\nhttps://wowguilds.com${prefix}/guides/${guide.slug}`,
            level: "success",
            source: "worker/growth-review",
            emoji: "📰",
          });

          console.log(
            `[Growth/Review] Published "${guide.title}" (score: ${score})`
          );
        } else if (score >= 5) {
          // Rewrite
          await prisma.guide.update({
            where: { id: guideId },
            data: { status: "rewriting", qualityScore: score },
          });
          await generateQueue.add(
            `rewrite:${guideId}`,
            {
              title: guide.title,
              targetKeyword: guide.targetKeyword || "",
              category: guide.category,
              tags: guide.tags,
              locale: guide.locale,
              contentPlanId: guide.contentPlanId || "",
              rewriteGuideId: guideId,
              rewriteIssues: review.issues,
            },
            { delay: 10000, attempts: 1 }
          );
          console.log(
            `[Growth/Review] Rewrite queued for "${guide.title}" (score: ${score}, issues: ${review.issues.join("; ")})`
          );
        } else {
          // Retire
          await prisma.guide.update({
            where: { id: guideId },
            data: { status: "retired", qualityScore: score },
          });
          await sendAlert({
            title: "Guide Retired (Low Quality)",
            message: `"${guide.title}" scored ${score}/10. Issues: ${review.issues.join("; ")}`,
            level: "warning",
            source: "worker/growth-review",
            emoji: "📝",
          });
          console.log(
            `[Growth/Review] Retired "${guide.title}" (score: ${score})`
          );
        }

        // Log
        const duration = Math.round((Date.now() - startTime) / 1000);
        await prisma.growthLog.create({
          data: {
            type: "review",
            status: "success",
            message: `Reviewed "${guide.title}": ${score}/10 → ${score >= 7 ? "published" : score >= 5 ? "rewriting" : "retired"}`,
            metadata: {
              guideId,
              scores: { ...review } as unknown as Prisma.InputJsonValue,
              action:
                score >= 7
                  ? "published"
                  : score >= 5
                    ? "rewriting"
                    : "retired",
            } as unknown as Prisma.InputJsonValue,
            cost: result.cost,
            duration,
          },
        });
      } catch (error) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        const msg =
          error instanceof Error ? error.message : String(error);
        await prisma.growthLog.create({
          data: {
            type: "review",
            status: "error",
            message: `Review failed for ${guideId}: ${msg.slice(0, 400)}`,
            duration,
          },
        });
        console.error(`[Growth/Review] Failed for ${guideId}:`, msg);
        throw error;
      }
    },
    { connection, concurrency: 1 }
  );
}
