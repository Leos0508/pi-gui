import { expect, test, type Page } from "@playwright/test";
import {
  chooseThreadGrouping,
  createSessionViaIpc,
  desktopShortcut,
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  waitForWorkspaceByPath,
} from "../helpers/electron-app";

function palette(window: Page) {
  return window.getByTestId("command-palette");
}

async function openPalette(window: Page): Promise<void> {
  await window.keyboard.press(desktopShortcut("K"));
  await expect(palette(window)).toBeVisible();
  await expect(window.getByTestId("command-palette-input")).toBeFocused();
}

test("folds a folder group and keeps it folded across restart", async () => {
  test.setTimeout(120_000);
  const userDataDir = await makeUserDataDir();
  const alphaPath = await makeWorkspace("collapse-alpha");
  const betaPath = await makeWorkspace("collapse-beta");
  const firstRun = await launchDesktop(userDataDir, {
    initialWorkspaces: [alphaPath, betaPath],
    testMode: "background",
  });

  let workspaceId = "";
  let workspaceName = "";
  try {
    const window = await firstRun.firstWindow();
    const alpha = await waitForWorkspaceByPath(window, alphaPath);
    await waitForWorkspaceByPath(window, betaPath);
    workspaceId = alpha.id;
    workspaceName = alpha.name;
    await createSessionViaIpc(window, alphaPath, "Alpha planning");
    await createSessionViaIpc(window, betaPath, "Beta planning");
    await chooseThreadGrouping(window, "workspace");

    const group = window.locator(`.workspace-group[data-workspace-id="${workspaceId}"]`);
    await expect(group.locator(".session-row__title")).toHaveText(["Alpha planning"]);

    // The chevron folds the group; the row itself still selects the folder.
    await group.getByRole("button", { name: `Collapse ${alpha.name}` }).click();
    await expect(group.locator(".session-row")).toHaveCount(0);
    await expect(group.getByRole("button", { name: `Expand ${alpha.name}` })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(window.locator(".workspace-group .session-row__title")).toHaveText([
      "Beta planning",
    ]);

    // Cmd/Ctrl+K lists the folded folder and opens it again.
    await openPalette(window);
    await window.keyboard.type(`Expand folder: ${alpha.name}`);
    await expect(palette(window).getByRole("option").first()).toContainText(
      `Expand folder: ${alpha.name}`,
    );
    await window.keyboard.press("Enter");
    await expect(group.locator(".session-row__title")).toHaveText(["Alpha planning"]);

    await group.getByRole("button", { name: `Collapse ${alpha.name}` }).click();
    await expect
      .poll(async () => (await getDesktopState(window)).collapsedWorkspaceIds)
      .toEqual([workspaceId]);
  } finally {
    await firstRun.close();
  }

  const secondRun = await launchDesktop(userDataDir, { testMode: "background" });
  try {
    const window = await secondRun.firstWindow();
    await waitForWorkspaceByPath(window, alphaPath);
    const group = window.locator(`.workspace-group[data-workspace-id="${workspaceId}"]`);
    await expect(group.getByRole("button", { name: `Expand ${workspaceName}` })).toBeVisible();
    await expect(group.locator(".session-row")).toHaveCount(0);
    await expect(window.locator(".workspace-group .session-row__title")).toHaveText([
      "Beta planning",
    ]);

    // The palette offers the inverse action once the folder is open again.
    await group.getByRole("button", { name: `Expand ${workspaceName}` }).click();
    await expect(group.locator(".session-row__title")).toHaveText(["Alpha planning"]);
    await openPalette(window);
    await window.keyboard.type(`Collapse folder: ${workspaceName}`);
    await expect(palette(window).getByRole("option").first()).toContainText(
      `Collapse folder: ${workspaceName}`,
    );
    await window.keyboard.press("Escape");
  } finally {
    await secondRun.close();
  }
});
