import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createNamedThread,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
} from "../helpers/electron-app";
import { expectExtensionViewReady } from "../helpers/desktop-extension-fixture";
import { desktopExtensionExamplesDirectory as examples } from "../helpers/desktop-extension-examples";
import { caption } from "./_demo-helpers";

async function openExample(window: Page, title: string): Promise<FrameLocator> {
  const workbench = window.getByTestId("workbench");
  if (!(await workbench.isVisible())) await window.getByTestId("toggle-side-panel").click();
  await window.waitForTimeout(1500);
  const tab = workbench.getByRole("tab", { name: title, exact: true });
  if (await tab.count()) await tab.click();
  else {
    const chooser = window.getByTestId("workbench-chooser");
    if (!(await chooser.isVisible())) await window.getByTestId("workbench-add-tab").click();
    await window.waitForTimeout(1500);
    await chooser.getByRole("button", { name: title, exact: true }).click();
  }
  const frame = window.frameLocator('[data-testid="extension-view-frame"]');
  await expect(frame.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expectExtensionViewReady(window);
  return frame;
}

// Tier 2 demo: the Test Runs example on main. The extension registers a desktop view:
// a web bundle it built, shown as a side panel tab in a sandboxed iframe, talking to
// the extension's Chord backend.
test("records the Tier 2 desktop view demo", async () => {
  test.setTimeout(240_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspace = await makeWorkspace("tier2-demo-workspace");
  await seedAgentDir(agentDir, { withOpenAiAuth: false, withDefaultModel: false });
  await writeFile(
    join(agentDir, "settings.json"),
    JSON.stringify({
      packages: [],
      extensions: [join(examples, "test-runs", "index.ts")],
      cacheWarming: "off",
    }),
  );
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspace],
    scrubProviderEnv: true,
    envOverrides: { PI_APP_TEST_MODE: undefined },
  });
  try {
    await harness.focusWindow();
    const window = await harness.firstWindow();
    await window.waitForTimeout(1500);
    await createNamedThread(window, "Tier 2 demo: Test Runs");
    await window.waitForTimeout(1500);
    const pause = (ms = 2500) => window.waitForTimeout(ms);

    await caption(
      window,
      "Tier 2 · 1/5",
      "The extension registers a desktop view: its own web bundle plus a Chord backend",
      `registerDesktopView(pi, {
  id: "test-runs", title: "Test Runs",
  frontend: new URL("./dist/desktop.js", import.meta.url),
  backend: () => defineFacet({ ... run(), stop(), state ... }),
});`,
    );
    await pause(5000);

    await caption(window, "Tier 2 · 2/5", "It shows up as a tab in the right side panel (add tab → Test Runs)");
    const frame = await openExample(window, "Test Runs");
    await pause(3500);

    await caption(window, "Tier 2 · 3/5", "The view runs in a sandboxed iframe and calls the backend over Chord: run the passing suite");
    await frame.getByLabel("Test suite", { exact: true }).selectOption("passing");
    await frame.getByRole("button", { name: "Run suite", exact: true }).click();
    await expect(
      frame.getByRole("heading", { name: "Passing fixture · Command completed · exit 0", exact: true }),
    ).toBeVisible();
    await pause(4000);

    await caption(window, "Tier 2 · 4/5", "Live output streams from the extension's process: the failing suite");
    await frame.getByLabel("Test suite", { exact: true }).selectOption("failing");
    await frame.getByRole("button", { name: "Run suite", exact: true }).click();
    await expect(
      frame.getByRole("heading", { name: "Failing fixture · Command failed · exit 1", exact: true }),
    ).toBeVisible();
    await pause(4000);

    await caption(window, "Tier 2 · 5/5", "Two-way: the slow suite, then Stop run cancels the real process");
    await frame.getByLabel("Test suite", { exact: true }).selectOption("slow");
    await frame.getByRole("button", { name: "Run suite", exact: true }).click();
    await expect(frame.getByLabel("Test output", { exact: true })).toContainText("Slow test started");
    await pause(3000);
    await frame.getByRole("button", { name: "Stop run", exact: true }).click();
    await expect(
      frame.getByRole("heading", { name: "Slow fixture · try Stop · Cancelled", exact: true }),
    ).toBeVisible();
    await pause(4500);
  } finally {
    await harness.close();
  }
});
