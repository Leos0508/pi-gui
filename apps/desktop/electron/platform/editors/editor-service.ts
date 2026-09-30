import { spawn } from "node:child_process";
import type { DesktopEditorList } from "../../../contracts/editors";
import {
  buildEditorLaunchCommand,
  createEditorDetectionHost,
  detectInstalledEditors,
  type DetectedEditor,
} from "./detect-editors";

export interface EditorServiceDeps {
  readonly detect: () => readonly DetectedEditor[];
  readonly launch: (command: string, args: readonly string[]) => Promise<void>;
}

function launchWithSpawn(command: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // A foreground editor owns its own process for as long as it is open, so the
    // launch must resolve when the process starts, not when it exits.
    const child = spawn(command, [...args], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
    child.once("error", reject);
  });
}

/**
 * Detects installed editors once, then answers list/open requests from that
 * cache. A launch failure clears the cache so the next menu reflects what is
 * still on disk, which covers an editor uninstalled while the app kept running.
 */
export class EditorService {
  private detected: readonly DetectedEditor[] | undefined;
  private preferredEditorId: string | undefined;
  private readonly deps: EditorServiceDeps;

  constructor(deps?: EditorServiceDeps) {
    this.deps = deps ?? {
      detect: () => detectInstalledEditors(createEditorDetectionHost()),
      launch: launchWithSpawn,
    };
  }

  list(): DesktopEditorList {
    const editors = this.detectedEditors();
    const preferredEditorId = editors.some((editor) => editor.id === this.preferredEditorId)
      ? this.preferredEditorId
      : undefined;
    return {
      editors: editors.map(({ id, label }) => ({ id, label })),
      ...(preferredEditorId ? { preferredEditorId } : {}),
    };
  }

  async open(workspacePath: string, editorId: string): Promise<DesktopEditorList> {
    const editor = this.findEditor(editorId) ?? this.redetect(editorId);
    if (!editor) {
      throw new Error(`Unknown editor: ${editorId}`);
    }
    const { command, args } = buildEditorLaunchCommand(editor, workspacePath);
    try {
      await this.deps.launch(command, args);
    } catch (error) {
      this.detected = undefined;
      throw error;
    }
    this.preferredEditorId = editor.id;
    return this.list();
  }

  private detectedEditors(): readonly DetectedEditor[] {
    this.detected ??= this.deps.detect();
    return this.detected;
  }

  private findEditor(editorId: string): DetectedEditor | undefined {
    return this.detectedEditors().find((editor) => editor.id === editorId);
  }

  private redetect(editorId: string): DetectedEditor | undefined {
    this.detected = undefined;
    return this.findEditor(editorId);
  }
}
