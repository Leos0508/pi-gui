/**
 * Editors pi-gui knows how to open a checkout in, with the per-platform facts
 * each probe needs. Detection lives in `detect-editors.ts`; this file is data.
 */

export interface WindowsEditorInstall {
  /** Directory under `%LOCALAPPDATA%\Programs`. */
  readonly directory: string;
  /** Executable inside that directory. */
  readonly executable: string;
}

export interface EditorDefinition {
  readonly id: string;
  readonly label: string;
  /** macOS application name without the `.app` suffix. */
  readonly macAppName?: string;
  /** Executable names resolved on the POSIX `PATH`. */
  readonly posixCommands?: readonly string[];
  /** Executable base names resolved as `<name>.exe` on the Windows `PATH`. */
  readonly windowsCommands?: readonly string[];
  readonly windowsInstalls?: readonly WindowsEditorInstall[];
  /** Linux `.desktop` file names, in GLib application-id form. */
  readonly linuxDesktopIds?: readonly string[];
}

/**
 * Order is the menu order, and the first detected entry is the default target
 * for the main button until the user picks a different one.
 */
export const EDITOR_CATALOG: readonly EditorDefinition[] = [
  {
    id: "vscode",
    label: "Visual Studio Code",
    macAppName: "Visual Studio Code",
    posixCommands: ["code"],
    windowsCommands: ["code"],
    windowsInstalls: [{ directory: "Microsoft VS Code", executable: "Code.exe" }],
    linuxDesktopIds: [
      "code.desktop",
      "com.microsoft.VSCode.desktop",
      "com.visualstudio.code.desktop",
      "code_code.desktop",
    ],
  },
  {
    id: "cursor",
    label: "Cursor",
    macAppName: "Cursor",
    posixCommands: ["cursor"],
    windowsCommands: ["cursor"],
    windowsInstalls: [{ directory: "cursor", executable: "Cursor.exe" }],
    linuxDesktopIds: ["cursor.desktop", "com.cursor.Cursor.desktop"],
  },
  {
    id: "zed",
    label: "Zed",
    macAppName: "Zed",
    posixCommands: ["zed"],
    linuxDesktopIds: ["dev.zed.Zed.desktop"],
  },
  {
    id: "windsurf",
    label: "Windsurf",
    macAppName: "Windsurf",
    posixCommands: ["windsurf"],
    linuxDesktopIds: ["windsurf.desktop"],
  },
  {
    id: "vscode-insiders",
    label: "Visual Studio Code Insiders",
    macAppName: "Visual Studio Code - Insiders",
    posixCommands: ["code-insiders"],
    windowsCommands: ["code-insiders"],
    windowsInstalls: [
      { directory: "Microsoft VS Code Insiders", executable: "Code - Insiders.exe" },
    ],
    linuxDesktopIds: ["code-insiders.desktop"],
  },
  {
    id: "sublime",
    label: "Sublime Text",
    macAppName: "Sublime Text",
    posixCommands: ["subl"],
    linuxDesktopIds: ["sublime_text.desktop"],
  },
  {
    id: "webstorm",
    label: "WebStorm",
    macAppName: "WebStorm",
    posixCommands: ["webstorm"],
    linuxDesktopIds: ["jetbrains-webstorm.desktop"],
  },
  {
    id: "intellij",
    label: "IntelliJ IDEA",
    macAppName: "IntelliJ IDEA",
    posixCommands: ["idea"],
    linuxDesktopIds: ["jetbrains-idea.desktop", "jetbrains-idea-ce.desktop"],
  },
  {
    id: "pycharm",
    label: "PyCharm",
    macAppName: "PyCharm",
    posixCommands: ["pycharm"],
    linuxDesktopIds: ["jetbrains-pycharm.desktop", "jetbrains-pycharm-ce.desktop"],
  },
  {
    id: "android-studio",
    label: "Android Studio",
    macAppName: "Android Studio",
    posixCommands: ["studio"],
    linuxDesktopIds: ["android-studio.desktop", "android-studio_android-studio.desktop"],
  },
  {
    id: "xcode",
    label: "Xcode",
    macAppName: "Xcode",
  },
];
