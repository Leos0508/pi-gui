import { expect, test } from "@playwright/test";
import { join } from "node:path";
import {
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
  writeProjectExtension,
} from "../helpers/electron-app";
import { caption } from "./_demo-helpers";

// Flags demo: two extensions register CLI flags; pi-gui offers them when a thread starts.
const deployTools = String.raw`
export default function deployTools(pi) {
  pi.registerFlag("env", { type: "string", description: "Target environment: staging or production" });
  pi.registerFlag("dry-run", { type: "boolean", description: "Print the plan without deploying" });
  const summary = () => "env=" + (pi.getFlag("env") ?? "unset") + " · dry-run=" + (pi.getFlag("dry-run") ? "on" : "off");
  pi.on("session_start", async (_e, ctx) => {
    ctx.ui.setStatus("deploy", "Deploy flags: " + summary());
  });
  pi.registerCommand("deploy", {
    description: "Deploy using the flags this thread started with",
    handler: async (_args, ctx) => {
      const env = pi.getFlag("env");
      const dryRun = pi.getFlag("dry-run") === true;
      pi.appendEntry("pi-gui.card", {
        title: dryRun ? "Deploy plan (dry run)" : "Deployed",
        subtitle: "flags read with pi.getFlag() at session start",
        tone: dryRun ? "warning" : "success",
        rows: [
          { label: "--env", value: String(env ?? "(not set)") },
          { label: "--dry-run", value: dryRun ? "true" : "false" },
        ],
      });
    },
  });
}
`;
const reviewPreset = String.raw`
export default function reviewPreset(pi) {
  pi.registerFlag("preset", { type: "string", description: "Preset to apply when the session starts" });
  pi.on("session_start", async (_e, ctx) => {
    const preset = pi.getFlag("preset");
    if (typeof preset === "string" && preset) {
      ctx.ui.notify('Preset "' + preset + '" activated', "info");
      ctx.ui.setStatus("preset", "Preset: " + preset);
    }
  });
}
`;

test("records the flags prototype demo", async () => {
  test.setTimeout(240_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  await seedAgentDir(agentDir);
  const workspacePath = await makeWorkspace("flags-demo-workspace");
  await writeProjectExtension(workspacePath, "deploy-tools.ts", deployTools);
  await writeProjectExtension(workspacePath, "review-preset.ts", reviewPreset);

  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    envOverrides: { PI_APP_TEST_MODE: undefined },
  });
  try {
    await harness.focusWindow();
    const page = await harness.firstWindow();
    await page.waitForTimeout(1500);
    const pause = (ms = 2500) => page.waitForTimeout(ms);

    await page.locator("#primary-sidebar").getByRole("button", { name: "New thread", exact: true }).click();
    await expect(page.getByTestId("new-thread-composer")).toBeVisible();
    await pause(1500);

    await caption(
      page,
      "Flags · 1/4",
      "A Flags badge beside the model picker, only because two loaded extensions registered flags",
      `pi.registerFlag("env", { type: "string", description: "Target environment" });
pi.registerFlag("dry-run", { type: "boolean", description: "Print the plan only" });
// later, in a handler:
const env = pi.getFlag("env");`,
    );
    await pause(4500);

    await caption(page, "Flags · 2/4", "Grouped by extension: a switch for on/off flags, a field for value flags");
    await page.getByTestId("extension-flags-badge").click();
    await expect(page.getByTestId("extension-flags-dropdown")).toBeVisible();
    await pause(3000);
    await page.getByLabel("--env").fill("staging");
    await pause(1200);
    await page.getByLabel("--dry-run").click();
    await pause(1200);
    await page.getByLabel("--preset").fill("review");
    await pause(2000);
    await expect(page.getByTestId("extension-flags-badge")).toHaveText("Flags · 3");
    await page.getByTestId("new-thread-composer").click();
    await pause(1500);

    await caption(page, "Flags · 3/4", "Start the thread with /deploy: pi gets the values at session start, same as typing them after `pi`");
    const composer = page.getByTestId("new-thread-composer");
    await composer.fill("/deploy ");
    await pause(1200);
    await composer.press("Enter");
    const card = page.getByTestId("extension-card").first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toContainText("staging");
    await expect(card).toContainText("true");
    await expect(page.getByText("Deploy flags: env=staging · dry-run=on")).toBeVisible();
    const dockToggle = page.getByTestId("extension-dock-toggle");
    if (await dockToggle.count()) await dockToggle.first().click();
    await expect(page.getByText("Preset: review")).toBeVisible();
    await pause(6000);

    await caption(page, "Flags · 4/4", "Flags belong to the thread: the next new thread starts with none set");
    await page.locator("#primary-sidebar").getByRole("button", { name: "New thread", exact: true }).click();
    await expect(page.getByTestId("extension-flags-badge")).toHaveText("Flags");
    await pause(4000);
  } finally {
    await harness.close();
  }
});
