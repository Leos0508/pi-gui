import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createNamedThread,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
  writeProjectExtension,
} from "../helpers/electron-app";
import { caption, runCommand } from "./_demo-helpers";

// Tier 1 demo: the extension declares a card as data through an ordinary pi call
// (pi.appendEntry with the "pi-gui.card" convention); pi-gui draws it with its own component.
const extensionSource = String.raw`
export default function ciWatch(pi) {
  pi.registerCommand("ci", {
    description: "Show the latest CI result as a card",
    handler: async (_args, ctx) => {
      ctx.ui.setStatus("ci", "CI: failing on main");
      pi.appendEntry("pi-gui.card", {
        title: "CI failed on main",
        subtitle: "unit-tests · 2 failed, 40 passed · 1m 12s",
        tone: "error",
        rows: [
          { label: "Job", value: "unit-tests (ubuntu-latest)" },
          { label: "Failed", value: "search.test.ts › returns [] for a blank query" },
          { label: "Commit", value: "a1b2c3d fix: trim search input" },
        ],
        actions: [{ label: "Open search.ts:3", path: "search.ts", line: 3 }],
      });
    },
  });
  pi.registerCommand("deploy", {
    description: "Show a deploy result as a card",
    handler: async (_args, ctx) => {
      ctx.ui.setStatus("ci", "CI: passing");
      pi.appendEntry("pi-gui.card", {
        title: "Deployed to production",
        subtitle: "web · v1.4.2 · 48s",
        tone: "success",
        rows: [
          { label: "URL", value: "https://app.example.com" },
          { label: "Region", value: "us-east-1" },
        ],
      });
    },
  });
  pi.registerCommand("terminal-card", {
    description: "The pre-Tier-1 way: appendEntry with a terminal renderer (invisible here)",
    handler: async () => {
      pi.appendEntry("status-card", { message: "old style entry", timestamp: Date.now() });
    },
  });
}
`;

test("records the Tier 1 card demo", async () => {
  test.setTimeout(240_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  await seedAgentDir(agentDir);
  const workspacePath = await makeWorkspace("tier1-demo-workspace");
  await writeFile(
    join(workspacePath, "search.ts"),
    [
      "export function search(items: string[], query: string): string[] {",
      "  const needle = query.trim().toLowerCase();",
      "  return items.filter((item) => item.toLowerCase().includes(needle));",
      "}",
      "",
    ].join("\n"),
  );
  await writeProjectExtension(workspacePath, "ci-watch.ts", extensionSource);

  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    envOverrides: { PI_APP_TEST_MODE: undefined },
  });
  try {
    await harness.focusWindow();
    const page = await harness.firstWindow();
    await page.waitForTimeout(1500);
    await createNamedThread(page, "Tier 1 demo: CI watch");
    await page.waitForTimeout(1500);
    const pause = (ms = 2500) => page.waitForTimeout(ms);

    await caption(
      page,
      "Tier 1 · 1/4",
      "The extension is plain pi code. It describes a card as data; no React, no build step.",
      `pi.appendEntry("pi-gui.card", {
  title: "CI failed on main",
  subtitle: "unit-tests · 2 failed, 40 passed",
  tone: "error",
  rows: [{ label: "Failed", value: "search.test.ts › ..." }],
  actions: [{ label: "Open search.ts:3", path: "search.ts", line: 3 }],
});`,
    );
    await pause(5000);

    await caption(page, "Tier 1 · 2/4", "/ci → pi-gui draws the card with its own component, on theme", undefined);
    await runCommand(page, "/ci");
    await expect(page.getByTestId("extension-card").first()).toBeVisible();
    await pause(4000);

    await caption(page, "Tier 1 · 3/4", "Buttons are real: 'Open search.ts:3' opens the file in the side panel");
    await page.getByRole("button", { name: "Open search.ts:3" }).click();
    await pause(4500);

    await caption(page, "Tier 1 · 4/4", "/deploy → a success card; the dock chip updated too. Terminal pi would show the same data as text.");
    await runCommand(page, "/deploy");
    await expect(page.getByTestId("extension-card").nth(1)).toBeVisible();
    await pause(5000);
  } finally {
    await harness.close();
  }
});
