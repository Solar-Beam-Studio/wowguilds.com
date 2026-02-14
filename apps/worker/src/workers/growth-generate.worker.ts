import { Worker, Queue, type Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma, Prisma } from "@wow/database";
import { QUEUE_NAMES } from "../queues";
import type { OpenRouterService } from "../services/openrouter.service";
import type { DataAggregationService } from "../services/data-aggregation.service";

interface GenerateJobData {
  title: string;
  targetKeyword: string;
  category: string;
  tags: string[];
  locale: string;
  contentPlanId: string;
  parentGuideId?: string; // set when generating translations
  rewriteGuideId?: string;
  rewriteIssues?: string[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function createGrowthGenerateWorker(
  connection: ConnectionOptions,
  openRouter: OpenRouterService,
  dataAgg: DataAggregationService
) {
  const reviewQueue = new Queue(QUEUE_NAMES.GROWTH_REVIEW, { connection });
  const generateQueue = new Queue(QUEUE_NAMES.GROWTH_GENERATE, { connection });

  return new Worker<GenerateJobData>(
    QUEUE_NAMES.GROWTH_GENERATE,
    async (job: Job<GenerateJobData>) => {
      const {
        title,
        targetKeyword,
        category,
        tags,
        locale,
        contentPlanId,
        parentGuideId,
        rewriteGuideId,
        rewriteIssues,
      } = job.data;
      const startTime = Date.now();

      console.log(`[Growth/Generate] Generating: "${title}" (${locale})`);

      try {
        // 1. Get relevant data
        const stats = await dataAgg.getStatsForCategory(category);

        // 2. Get existing published guides for internal linking
        const existingGuides = await prisma.guide.findMany({
          where: { status: "published", locale },
          select: { slug: true, title: true, category: true },
          take: 20,
        });

        // 3. Build prompt
        const isTranslation = locale === "fr";
        const isRewrite = !!rewriteGuideId;

        let systemPrompt: string;
        let userPrompt: string;

        if (isTranslation && parentGuideId) {
          const parent = await prisma.guide.findUnique({
            where: { id: parentGuideId },
            select: { content: true, title: true, metaTitle: true, metaDescription: true },
          });
          if (!parent) throw new Error(`Parent guide ${parentGuideId} not found`);

          systemPrompt = `You are a professional French translator for gaming content. Translate the following World of Warcraft article to French. Keep the same markdown structure, data citations, and internal links. Use natural French gaming vocabulary (keep English terms like "Mythic+", "PvP", "DPS" etc. as-is since French WoW players use them). Return only the translated markdown content, nothing else.`;
          userPrompt = parent.content;
        } else {
          systemPrompt = `You are an expert World of Warcraft content writer for wowguilds.com. Write SEO-optimized articles that:
- Are 1,200-2,000 words
- Use real player statistics from our database (provided below) as unique data points
- Include natural CTAs to the guild lookup tool at wowguilds.com
- Use proper markdown formatting (## headings, **bold**, bullet lists)
- Are informative, practical, and written for WoW players
- Include a brief intro and conclusion
- Don't use clickbait or fluff
${isRewrite ? `\nThis is a REWRITE. Fix these issues: ${rewriteIssues?.join(", ")}` : ""}

Return only the markdown article content, nothing else.`;

          const internalLinks = existingGuides
            .map((g) => `- [${g.title}](/guides/${g.slug})`)
            .join("\n");

          userPrompt = `## Article Brief
Title: ${title}
Target Keyword: ${targetKeyword}
Category: ${category}
Tags: ${tags.join(", ")}

## Real Data From Our Database
${JSON.stringify(stats, null, 2)}

## Existing Guides (for internal linking)
${internalLinks || "None yet — this is one of our first articles."}

Write the article now.`;
        }

        const articleResult = await openRouter.complete(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          { temperature: 0.7, maxTokens: 4096 }
        );

        let metaTitle = title.slice(0, 60);
        let metaDescription = `${title} - Data-backed guide from wowguilds.com`;
        let totalCost = articleResult.cost;

        // 4. Generate meta tags (skip for translations — translate parent's meta)
        if (isTranslation && parentGuideId) {
          const parent = await prisma.guide.findUnique({
            where: { id: parentGuideId },
            select: { metaTitle: true, metaDescription: true },
          });
          if (parent?.metaTitle) {
            const metaResult = await openRouter.complete(
              [
                {
                  role: "system",
                  content:
                    "Translate these SEO meta tags to French. Return JSON: {\"metaTitle\": \"...\", \"metaDescription\": \"...\"}",
                },
                {
                  role: "user",
                  content: JSON.stringify({
                    metaTitle: parent.metaTitle,
                    metaDescription: parent.metaDescription,
                  }),
                },
              ],
              { jsonMode: true, maxTokens: 256 }
            );
            totalCost += metaResult.cost;
            try {
              const meta = JSON.parse(metaResult.content);
              metaTitle = meta.metaTitle?.slice(0, 60) || metaTitle;
              metaDescription = meta.metaDescription?.slice(0, 160) || metaDescription;
            } catch { /* use defaults */ }
          }
        } else if (!isTranslation) {
          const metaResult = await openRouter.complete(
            [
              {
                role: "system",
                content: `Generate SEO meta tags for this WoW article. Return JSON:
{"metaTitle": "under 60 chars, include primary keyword", "metaDescription": "under 160 chars, compelling description with keyword"}`,
              },
              {
                role: "user",
                content: `Title: ${title}\nKeyword: ${targetKeyword}\nCategory: ${category}`,
              },
            ],
            { jsonMode: true, maxTokens: 256 }
          );
          totalCost += metaResult.cost;
          try {
            const meta = JSON.parse(metaResult.content);
            metaTitle = meta.metaTitle?.slice(0, 60) || metaTitle;
            metaDescription =
              meta.metaDescription?.slice(0, 160) || metaDescription;
          } catch { /* use defaults */ }
        }

        // 5. Save guide
        const slug = slugify(title);
        const content = articleResult.content;
        const wordCount = content.split(/\s+/).length;

        const guideData = {
          slug,
          locale,
          status: isRewrite ? "draft" as const : "draft" as const,
          title,
          metaTitle,
          metaDescription,
          content,
          category,
          tags,
          targetKeyword,
          relatedSlugs: existingGuides.slice(0, 3).map((g) => g.slug),
          wordCount,
          dataSnapshot: stats as unknown as Prisma.InputJsonValue,
          aiModel: articleResult.model,
          aiCost: totalCost,
          parentGuideId: parentGuideId || undefined,
          contentPlanId,
        };

        let guide;
        if (rewriteGuideId) {
          guide = await prisma.guide.update({
            where: { id: rewriteGuideId },
            data: {
              ...guideData,
              status: "draft",
            },
          });
        } else {
          guide = await prisma.guide.create({ data: guideData });
        }

        // 6. Enqueue review
        await reviewQueue.add(
          `review:${guide.id}`,
          { guideId: guide.id },
          { attempts: 2, backoff: { type: "exponential", delay: 30000 } }
        );

        // 7. Enqueue French translation if this is an English original
        if (locale === "en" && !parentGuideId) {
          await generateQueue.add(
            `translate:fr:${slug}`,
            {
              title,
              targetKeyword,
              category,
              tags,
              locale: "fr",
              contentPlanId,
              parentGuideId: guide.id,
            },
            { delay: 5000, attempts: 2 }
          );
        }

        // 8. Log
        const duration = Math.round((Date.now() - startTime) / 1000);
        await prisma.growthLog.create({
          data: {
            type: "generation",
            status: "success",
            message: `Generated "${title}" (${locale}, ${wordCount} words)`,
            metadata: {
              guideId: guide.id,
              slug,
              locale,
              wordCount,
              model: articleResult.model,
              isTranslation,
              isRewrite,
            },
            cost: totalCost,
            duration,
          },
        });

        console.log(
          `[Growth/Generate] Done: "${title}" (${locale}, ${wordCount}w, $${totalCost.toFixed(4)}, ${duration}s)`
        );
      } catch (error) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        const msg =
          error instanceof Error ? error.message : String(error);
        await prisma.growthLog.create({
          data: {
            type: "generation",
            status: "error",
            message: `Failed "${title}": ${msg.slice(0, 400)}`,
            duration,
          },
        });
        console.error(`[Growth/Generate] Failed "${title}":`, msg);
        throw error;
      }
    },
    {
      connection,
      concurrency: 1,
      limiter: { max: 10, duration: 3600000 }, // max 10/hour
    }
  );
}
