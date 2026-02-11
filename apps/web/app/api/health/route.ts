import { NextResponse } from "next/server";
import { prisma, sendAlert } from "@wow/database";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "healthy", timestamp: new Date().toISOString() });
  } catch {
    sendAlert({
      title: "Database Unreachable",
      message: "Health check failed — cannot connect to PostgreSQL",
      level: "error",
      source: "web/health",
      emoji: "🗄️",
    });
    return NextResponse.json(
      { status: "unhealthy", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
