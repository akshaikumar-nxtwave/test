import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // prevents static build + pre-execution

export async function POST(req: NextRequest) {
  const { supabase } = require("../../../lib/supabase");
  const { getRedis } = require("../../../lib/redis");

  const redis = getRedis();

  const sessionId = req.cookies.get("review_session_id")?.value;

  if (!sessionId) {
    return NextResponse.json({ error: "No session found" }, { status: 400 });
  }

  // Delete repos for that session
  const { error } = await supabase
    .from("repos")
    .delete()
    .eq("session_id", sessionId);

  if (error) {
    console.error("Supabase cleanup error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clean Redis queue keys
  await redis.del(
    "repo-processing:meta",
    "repo-processing:id",
    "repo-processing:completed",
    "repo-processing:failed",
    "repo-processing:wait",
    "repo-processing:paused",
    "repo-processing:delayed",
    "repo-processing:active",
    "repo-processing:events",
    "repo-processing:priority",
    "repo-processing:stalled",
    "repo-processing:repeat"
  );

  return NextResponse.json({ success: true });
}
