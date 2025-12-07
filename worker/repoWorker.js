const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const os = require("os");
const simpleGit = require("simple-git");
const fs = require("fs");
const path = require("path");
const { supabase } = require("../lib/supabase");
const { chunkText } = require("../lib/chunkText");

console.log("Repo Worker module loaded");

async function processRepoJob(job) {
  const { sessionId, repoId, git_url } = job.data;

  console.log("Processing repo:", repoId, git_url);

  const repoPath = path.join(os.tmpdir(), "code-review", repoId);

  if (fs.existsSync(repoPath)) {
    fs.rmSync(repoPath, { recursive: true, force: true });
  }

  fs.mkdirSync(repoPath, { recursive: true });

  const git = simpleGit();

  try {
    await git.clone(git_url, repoPath);
    console.log("Repo cloned at:", repoPath);

    await supabase
      .from("repos")
      .update({ status: "indexing" })
      .eq("id", repoId);
  } catch (err) {
    console.error("Clone error:", err);
    await supabase.from("repos").update({ status: "failed" }).eq("id", repoId);
    throw err;
  }

  const repoFolder = git_url.split("/").pop()?.replace(".git", "") || "";
  const nestedPath = path.join(repoPath, repoFolder);

  const targetPath = fs.existsSync(nestedPath) ? nestedPath : repoPath;

  console.log("Scanning files in:", targetPath);

  const allFiles = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (["node_modules", ".git", "dist", "build", "out"].includes(entry.name)) continue;
        walk(fullPath);
      } else {
        allFiles.push(fullPath);
      }
    }
  }

  walk(targetPath);

  console.log(`Found ${allFiles.length} files in repo`);

  for (const file of allFiles) {
    let content = "";

    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      console.log("Skipping unreadable file:", file);
      continue;
    }

    const chunks = chunkText(content);

    const cleanPath = file
      .replace(targetPath + path.sep, "")
      .replace(/\\/g, "/");

    for (let i = 0; i < chunks.length; i++) {
      await supabase.from("code_chunks").insert({
        repo_id: repoId,
        file_path: cleanPath,
        chunk_index: i,
        content: chunks[i],
      });
    }
  }

  // STEP COMPLETE
  await supabase
    .from("repos")
    .update({ status: "indexed" })
    .eq("id", repoId);

  console.log(`Repo indexing complete: ${repoId}`);

  return { repoId, files: allFiles.length };
}

module.exports = { processRepoJob };
