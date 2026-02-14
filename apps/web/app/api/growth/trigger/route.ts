import { NextResponse } from "next/server";
import { Queue } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const strategyQueue = new Queue("growth-strategy", { connection });

export async function POST(request: Request) {
  // Simple secret check — reuse BETTER_AUTH_SECRET as admin token
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.BETTER_AUTH_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await strategyQueue.add(
    `manual-${Date.now()}`,
    { manual: true },
    { attempts: 1 }
  );

  return NextResponse.json({ ok: true, message: "Strategy job enqueued" });
}
