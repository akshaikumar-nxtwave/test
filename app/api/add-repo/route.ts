import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";

export const dynamic = "force-dynamic"; // prevent Next from preloading this file

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get("review_session_id")?.value;

  if (!sessionId) {
    return NextResponse.json({ error: "No session found." }, { status: 400 });
  }

  const { git_url } = await req.json();
  if (!git_url) {
    return NextResponse.json({ error: "git_url is required" }, { status: 400 });
  }

  // ⬇️ runtime import to prevent build-time Redis/BullMQ execution
  const { supabase } = require("../../../lib/supabase");
  const { getQueue } = require("../../../lib/queue");

  const repoId = uuid();

  await supabase.from("repos").insert({
    id: repoId,
    session_id: sessionId,
    git_url,
    name: git_url.split("/").pop()?.replace(".git", "") || "unknown",
    status: "pending",
  });

  // getQueue lazily creates the BullMQ queue using runtime redis
  const queue = getQueue();

  await queue.add("processRepo", {
    sessionId,
    repoId,
    git_url,
  });

  return NextResponse.json({
    repo_id: repoId,
    status: "queued",
  });
}
