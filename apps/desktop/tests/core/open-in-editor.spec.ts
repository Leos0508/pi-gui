import { expect, test } from "@playwright/test";
import {
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  waitForWorkspaceByPath,
} from "../helpers/electron-app";

/**
 * The "open in editor" control is a split button: the main half opens the
 * preferred editor, the thin chevron half lists what main actually detected on
 * this machine. Detection is per-host, so the menu assertions allow either a
 * populated list or the empty notice plus the folder fallback.
 */
test("opens the editor menu beside the sidebar toggle", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const workspace = await makeWorkspace("open-in-editor");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspace],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await waitForWorkspaceByPath(window, workspace);

    const mainButton = window.getByTestId("open-in-editor");
    const trigger = window.getByTestId("open-in-editor-menu-trigger");
    await expect(window.getByTestId("sidebar-toggle")).toBeVisible();
    await expect(mainButton).toBeVisible();
    await expect(trigger).toBeVisible();
    await expect(window.getByTestId("open-in-editor-menu")).toHaveCount(0);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    await trigger.click();
    const menu = window.getByTestId("open-in-editor-menu");
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(menu.locator(".open-in-editor__item").first()).toBeVisible();

    await window.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    await trigger.click();
    await expect(menu).toBeVisible();
    await trigger.click();
    await expect(menu).toHaveCount(0);

    const list = await window.evaluate(async () => {
      const app = globalThis.window.piApp;
      if (!app) {
        throw new Error("piApp IPC bridge is unavailable");
      }
      return app.listEditors();
    });
    expect(Array.isArray(list.editors)).toBe(true);
    if (list.preferredEditorId) {
      expect(list.editors.map((editor) => editor.id)).toContain(list.preferredEditorId);
    }

    const state = await getDesktopState(window);
    const selected = state.workspaces.find((entry) => entry.path === workspace);
    expect(selected).toBeDefined();
    const rejection = await window.evaluate(async (workspaceId: string) => {
      const app = globalThis.window.piApp;
      if (!app) {
        throw new Error("piApp IPC bridge is unavailable");
      }
      try {
        await app.openWorkspaceInEditor(workspaceId, "not-a-real-editor");
        return "resolved";
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    }, selected?.id ?? "");
    expect(rejection).toContain("Unknown editor");

    // Collapsing the sidebar pulls the title left, into the strip the split
    // button sits in. The shell reserves room so the two never overlap.
    await window.getByTestId("sidebar-toggle").click();
    await expect(mainButton).toBeVisible();
    const editorControl = await window.locator(".open-in-editor").boundingBox();
    const title = await window.locator(".topbar__title").boundingBox();
    expect(editorControl).not.toBeNull();
    expect(title).not.toBeNull();
    if (editorControl && title) {
      expect(editorControl.x + editorControl.width).toBeLessThanOrEqual(title.x);
    }
  } finally {
    await harness.close();
  }
});
