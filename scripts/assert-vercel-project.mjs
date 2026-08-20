import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const EXPECTED_PROJECT = "ninhbinhjourney";
const EXPECTED_ORG_ID = "team_IsIdBXLLKEgZtHxgkLrzSs55";

export function validateVercelProjectLink(settings) {
  const blockers = [];
  if (settings?.projectName !== EXPECTED_PROJECT) blockers.push(`projectName phải là ${EXPECTED_PROJECT}`);
  if (settings?.orgId !== EXPECTED_ORG_ID) blockers.push("orgId không khớp goldencard production scope");
  if (typeof settings?.projectId !== "string" || !settings.projectId.startsWith("prj_")) blockers.push("projectId không hợp lệ");
  return blockers;
}

async function main() {
  const projectFile = resolve(process.cwd(), ".vercel", "project.json");
  let settings;
  try {
    settings = JSON.parse(await readFile(projectFile, "utf8"));
  } catch {
    console.error("A6 BLOCKED: worktree chưa link Vercel. Chỉ link rõ project goldencard/ninhbinhjourney; không dùng auto-detected project name.");
    process.exitCode = 1;
    return;
  }
  const blockers = validateVercelProjectLink(settings);
  if (blockers.length) {
    console.error(`A6 BLOCKED: Vercel link sai — ${blockers.join("; ")}.`);
    process.exitCode = 1;
    return;
  }
  console.log(`A6 VERCEL LINK OK: ${EXPECTED_PROJECT} (${settings.projectId}).`);
}

if (resolve(process.argv[1] ?? "") === resolve(import.meta.filename)) await main();
