import { NextRequest, NextResponse } from "next/server";
import { fetchRealms } from "@/lib/blizzard";

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region") || "eu";

  try {
    const realms = await fetchRealms(region);
    return NextResponse.json(realms, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
