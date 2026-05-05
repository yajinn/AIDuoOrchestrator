#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

function findRole(prompt) {
  const match = prompt.match(/ROLE:\s*([A-Za-z]+)/);
  if (!match) {
    throw new Error("ROLE not found in prompt");
  }

  return match[1];
}

async function maybeApplyWrite(cwd, writeSpec) {
  if (!writeSpec) {
    return;
  }

  const targetPath = join(cwd, writeSpec.path);
  const previous = await readFile(targetPath, "utf8").catch(() => "");
  const next = writeSpec.mode === "replace" ? writeSpec.content : `${previous}${writeSpec.content}`;
  await writeFile(targetPath, next, "utf8");
}

const cwd = process.cwd();
const prompt = process.argv.at(-1) ?? "";
const role = findRole(prompt);
const outputLastMessageIndex = process.argv.indexOf("--output-last-message");
const outputLastMessagePath = outputLastMessageIndex >= 0 ? process.argv[outputLastMessageIndex + 1] : undefined;
const scenarioPath = join(cwd, ".ai-duo-test-scenario.json");
const scenario = JSON.parse(await readFile(scenarioPath, "utf8"));
const response = scenario.codex?.[role];

if (!response) {
  throw new Error(`Missing fake Codex response for role ${role}`);
}

await maybeApplyWrite(cwd, response.write);

if (outputLastMessagePath) {
  await writeFile(outputLastMessagePath, `${response.payload.markdown}\n`, "utf8");
}

process.stderr.write("fake codex stderr\n");
process.stdout.write(JSON.stringify(response.payload));
