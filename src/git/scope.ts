import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runProcess } from "../utils/process";

export interface GitReviewScope {
  status: string;
  diff: string;
  untrackedFiles: string[];
  reviewText: string;
}

async function fileContentSnippet(workspaceRoot: string, relativePath: string): Promise<string> {
  try {
    const fullPath = join(workspaceRoot, relativePath);
    const content = await readFile(fullPath, "utf8");
    return `--- BEGIN FILE ${relativePath} ---\n${content}\n--- END FILE ${relativePath} ---`;
  } catch {
    return `--- BEGIN FILE ${relativePath} ---\n<unreadable or binary>\n--- END FILE ${relativePath} ---`;
  }
}

export async function captureGitReviewScope(workspaceRoot: string): Promise<GitReviewScope> {
  const [statusResult, diffResult, untrackedResult] = await Promise.all([
    runProcess("git", ["status", "--short"], workspaceRoot),
    runProcess("git", ["diff", "--binary", "--no-ext-diff", "HEAD", "--"], workspaceRoot),
    runProcess("git", ["ls-files", "--others", "--exclude-standard"], workspaceRoot)
  ]);

  const untrackedFiles = untrackedResult.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const untrackedSections = await Promise.all(
    untrackedFiles.map(async (relativePath) => fileContentSnippet(workspaceRoot, relativePath))
  );

  const reviewText = [
    "## Git status",
    statusResult.stdout.trim() || "(clean)",
    "",
    "## Diff",
    diffResult.stdout.trim() || "(no diff)",
    ...(untrackedSections.length > 0 ? ["", "## Untracked files", ...untrackedSections] : [])
  ].join("\n");

  return {
    status: statusResult.stdout,
    diff: diffResult.stdout,
    untrackedFiles,
    reviewText
  };
}
