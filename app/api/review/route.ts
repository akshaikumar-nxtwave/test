import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { repo_id, prompt } = await req.json();

  if (!repo_id || !prompt) {
    return NextResponse.json(
      { error: "repo_id and prompt required" },
      { status: 400 }
    );
  }

  // Runtime imports to prevent build-time execution
  const { embedText } = require("../../../lib/embed");
  const { supabase } = require("../../../lib/supabase") as {
    supabase: import("@supabase/supabase-js").SupabaseClient<any, any, any>;
  };
  const Mistral = require("@mistralai/mistralai").default;

  const client = new Mistral(process.env.MISTRAL_API_KEY);

  const qEmbed = await embedText(prompt);

  interface CodeChunk {
    file_path: string;
    content: string;
    embedding?: number[] | null;
  }


  const rpcResult = await supabase.rpc(
    "match_code_chunks",
    {
      query_embedding: qEmbed,
      repo_id_input: repo_id,
      match_count: 10,
    }
  );

  const chunks = (rpcResult.data as unknown) as CodeChunk[];
  const error = (rpcResult as unknown as { error?: { message?: string } }).error ?? "";

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!chunks || !Array.isArray(chunks)) {
    console.error("No chunks returned from match_code_chunks", chunks);
    return NextResponse.json({ error: "No matching code chunks found" }, { status: 500 });
  }

  const context = chunks
    .map((c: CodeChunk) => `// FILE: ${c.file_path}\n${c.content}`)
    .join("\n\n");

  const resp = await client.chat({
    model: "mistral-large-latest",
    messages: [
      {
        role: "user",
        content: `Prompt:${prompt} Relevant Code: ${context}`,
      },
    ],
  });

  return NextResponse.json({
    answer: resp.choices[0].message.content,
  });
}
