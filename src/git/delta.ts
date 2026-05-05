import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { runProcess } from "../utils/process";

export interface WorkspaceSnapshot {
  trackedDirtyPaths: string[];
  signature: string;
}

export async function captureWorkspaceSnapshot(workspaceRoot: string): Promise<WorkspaceSnapshot> {
  const statusResult = await runProcess("git", ["status", "--porcelain"], workspaceRoot);
  const trackedDirtyPaths = statusResult.stdout
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0 && !line.startsWith("?? "))
    .map((line) => line.slice(3).trim());

  const signature = createHash("sha256").update(trackedDirtyPaths.sort().join("\n")).digest("hex");
  return {
    trackedDirtyPaths,
    signature
  };
}

export function snapshotsDiffer(left: WorkspaceSnapshot, right: WorkspaceSnapshot): boolean {
  return left.signature !== right.signature;
}

export async function writeDiffArtifact(
  workspaceRoot: string,
  runDir: string,
  filename: string
): Promise<{ path: string; content: string }> {
  const diffResult = await runProcess("git", ["diff", "--binary", "--no-ext-diff", "HEAD", "--"], workspaceRoot);
  const fullPath = join(runDir, filename);
  await writeFile(fullPath, diffResult.stdout, "utf8");
  return {
    path: fullPath,
    content: diffResult.stdout
  };
}
