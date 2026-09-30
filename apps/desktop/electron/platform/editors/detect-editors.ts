import { accessSync, constants, existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { EDITOR_CATALOG, type EditorDefinition, type WindowsInstallRoot } from "./editor-catalog";

export type DetectedEditorLaunch =
  | { readonly kind: "mac-app"; readonly appPath: string }
  | { readonly kind: "command"; readonly commandPath: string }
  | {
      readonly kind: "desktop-entry";
      readonly desktopId: string;
      readonly desktopPath: string;
      readonly launcher: "gtk-launch" | "gio";
    };

export interface DetectedEditor {
  readonly id: string;
  readonly label: string;
  readonly launch: DetectedEditorLaunch;
}

/** Filesystem and environment facts a probe is allowed to read. */
export interface EditorDetectionHost {
  readonly platform: NodeJS.Platform;
  readonly homeDir: string;
  readonly env: NodeJS.ProcessEnv;
  readonly exists: (absolutePath: string) => boolean;
  readonly isExecutable: (absolutePath: string) => boolean;
  readonly listDirectory: (absolutePath: string) => readonly string[];
}

export function detectInstalledEditors(host: EditorDetectionHost): readonly DetectedEditor[] {
  if (host.platform === "darwin") {
    return detectMacEditors(host);
  }
  if (host.platform === "win32") {
    return detectWindowsEditors(host);
  }
  return detectLinuxEditors(host);
}

export function createEditorDetectionHost(): EditorDetectionHost {
  return {
    platform: process.platform,
    homeDir: homedir(),
    env: process.env,
    exists: (absolutePath) => existsSync(absolutePath),
    isExecutable: (absolutePath) => {
      try {
        accessSync(absolutePath, constants.X_OK);
        return statSync(absolutePath).isFile();
      } catch {
        return false;
      }
    },
    listDirectory: (absolutePath) => {
      try {
        return readdirSync(absolutePath);
      } catch {
        return [];
      }
    },
  };
}

/** Command and arguments that hand `workspacePath` to a detected editor. */
export function buildEditorLaunchCommand(
  editor: DetectedEditor,
  workspacePath: string,
): { readonly command: string; readonly args: readonly string[] } {
  switch (editor.launch.kind) {
    case "mac-app":
      return {
        command: "open",
        // The resolved bundle path beats `-a <name>`, which matches by display name.
        args: ["-a", editor.launch.appPath, workspacePath],
      };
    case "command":
      return { command: editor.launch.commandPath, args: [workspacePath] };
    case "desktop-entry":
      return editor.launch.launcher === "gtk-launch"
        ? { command: "gtk-launch", args: [editor.launch.desktopId, workspacePath] }
        : { command: "gio", args: ["launch", editor.launch.desktopPath, workspacePath] };
  }
}

function detectMacEditors(host: EditorDetectionHost): readonly DetectedEditor[] {
  const pathApi = path.posix;
  const appDirectories = ["/Applications", pathApi.join(host.homeDir, "Applications")];
  const detected: DetectedEditor[] = [];
  for (const definition of EDITOR_CATALOG) {
    if (!definition.macAppName) {
      continue;
    }
    const bundleName = `${definition.macAppName}.app`;
    const appPath = appDirectories
      .map((directory) => pathApi.join(directory, bundleName))
      .find((candidate) => host.exists(candidate));
    if (appPath) {
      detected.push(toDetectedEditor(definition, { kind: "mac-app", appPath }));
    }
  }
  return detected;
}

function detectLinuxEditors(host: EditorDetectionHost): readonly DetectedEditor[] {
  const pathApi = path.posix;
  const applicationDirectories = [
    "/usr/share/applications",
    "/usr/local/share/applications",
    pathApi.join(host.homeDir, ".local/share/applications"),
    "/var/lib/flatpak/exports/share/applications",
    pathApi.join(host.homeDir, ".local/share/flatpak/exports/share/applications"),
    "/var/lib/snapd/desktop/applications",
  ];
  const available = new Set(
    applicationDirectories.flatMap((directory) => host.listDirectory(directory)),
  );
  const gtkLaunch = resolvePosixCommand(host, "gtk-launch");
  const detected: DetectedEditor[] = [];
  for (const definition of EDITOR_CATALOG) {
    // A PATH executable is more reliable than a desktop entry: entries such as
    // Android Studio ship an `Exec=` line without a `%f` field code, and
    // gtk-launch then cannot forward the checkout path.
    const commandPath = (definition.posixCommands ?? [])
      .map((command) => resolvePosixCommand(host, command))
      .find((candidate): candidate is string => Boolean(candidate));
    if (commandPath) {
      detected.push(toDetectedEditor(definition, { kind: "command", commandPath }));
      continue;
    }
    const desktopId = definition.linuxDesktopIds?.find((id) => available.has(id));
    if (!desktopId) {
      continue;
    }
    const desktopDirectory = applicationDirectories.find((directory) =>
      host.exists(pathApi.join(directory, desktopId)),
    );
    detected.push(
      toDetectedEditor(definition, {
        kind: "desktop-entry",
        desktopId,
        desktopPath: desktopDirectory
          ? pathApi.join(desktopDirectory, desktopId)
          : pathApi.join("/usr/share/applications", desktopId),
        launcher: gtkLaunch ? "gtk-launch" : "gio",
      }),
    );
  }
  return detected;
}

function detectWindowsEditors(host: EditorDetectionHost): readonly DetectedEditor[] {
  const pathApi = path.win32;
  const detected: DetectedEditor[] = [];
  for (const definition of EDITOR_CATALOG) {
    const installed = (definition.windowsInstalls ?? [])
      .map((install) => {
        const root = resolveWindowsInstallRoot(host, install.root);
        return root ? pathApi.join(root, install.directory, install.executable) : undefined;
      })
      .find((candidate): candidate is string => candidate !== undefined && host.exists(candidate));
    const commandPath = installed
      ? installed
      : (definition.windowsCommands ?? [])
          .map((command) => resolveWindowsCommand(host, `${command}.exe`))
          .find((candidate): candidate is string => Boolean(candidate));
    if (commandPath) {
      detected.push(toDetectedEditor(definition, { kind: "command", commandPath }));
    }
  }
  return detected;
}

/** Environment directory a `windowsInstalls` entry is relative to. */
export function resolveWindowsInstallRoot(
  host: EditorDetectionHost,
  root: WindowsInstallRoot,
): string | undefined {
  switch (root) {
    case "localAppData":
      return host.env.LOCALAPPDATA ?? host.env.LocalAppData;
    case "programFiles":
      return host.env.ProgramFiles ?? host.env.PROGRAMFILES;
    case "programFilesX86":
      return host.env["ProgramFiles(x86)"] ?? host.env["PROGRAMFILES(X86)"];
  }
}

function toDetectedEditor(
  definition: EditorDefinition,
  launch: DetectedEditorLaunch,
): DetectedEditor {
  return { id: definition.id, label: definition.label, launch };
}

export function resolvePosixCommand(
  host: EditorDetectionHost,
  command: string,
): string | undefined {
  const pathApi = host.platform === "win32" ? path.win32 : path.posix;
  for (const directory of (host.env.PATH ?? "").split(pathApi.delimiter)) {
    if (!directory) {
      continue;
    }
    const candidate = pathApi.join(directory, command);
    if (host.isExecutable(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function resolveWindowsCommand(host: EditorDetectionHost, executable: string): string | undefined {
  const pathApi = path.win32;
  for (const directory of (host.env.PATH ?? "").split(pathApi.delimiter)) {
    const entry = directory.replace(/^"|"$/g, "");
    if (!entry) {
      continue;
    }
    const candidate = pathApi.join(entry, executable);
    if (host.exists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}
