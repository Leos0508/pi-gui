import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { DesktopEditorDescriptor, DesktopEditorList } from "../../../../contracts/editors";
import type { PiDesktopApi } from "../../../../contracts/ipc";

interface UseOpenInEditorParams {
  readonly api: PiDesktopApi | undefined;
  readonly workspaceId: string | undefined;
  readonly onOpenFolder: () => void;
}

export interface OpenInEditorState {
  readonly editors: readonly DesktopEditorDescriptor[];
  readonly preferredEditorId: string | undefined;
  readonly menuOpen: boolean;
  readonly busy: boolean;
  readonly error: string | undefined;
  readonly targetLabel: string | undefined;
  readonly wrapRef: RefObject<HTMLDivElement | null>;
  readonly toggleMenu: () => void;
  readonly openIn: (editorId?: string) => void;
}

/**
 * Owns the split button's editor list, its menu, and the open request. The
 * list comes from main, so this never decides on its own which IDEs exist.
 */
export function useOpenInEditor(params: UseOpenInEditorParams): OpenInEditorState {
  const { api, workspaceId, onOpenFolder } = params;
  const [list, setList] = useState<DesktopEditorList>({ editors: [] });
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!api) {
      return undefined;
    }
    let cancelled = false;
    void api
      .listEditors()
      .then((next) => {
        if (!cancelled) {
          setList(next);
        }
      })
      .catch((cause: unknown) => {
        console.error("[renderer] listEditors failed", cause);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && !(wrapRef.current?.contains(target) ?? false)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const toggleMenu = useCallback(() => {
    setError(undefined);
    setMenuOpen((current) => !current);
  }, []);

  const openIn = useCallback(
    (editorId?: string) => {
      setMenuOpen(false);
      if (!api || !workspaceId || busy) {
        return;
      }
      const target = editorId ?? list.preferredEditorId ?? list.editors[0]?.id;
      if (!target) {
        onOpenFolder();
        return;
      }
      setBusy(true);
      setError(undefined);
      void api
        .openWorkspaceInEditor(workspaceId, target)
        .then((next) => {
          setList(next);
        })
        .catch((cause: unknown) => {
          console.error("[renderer] openWorkspaceInEditor failed", cause);
          setError("Could not open that editor. Try another one.");
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [api, busy, list.editors, list.preferredEditorId, onOpenFolder, workspaceId],
  );

  const preferred =
    list.editors.find((editor) => editor.id === list.preferredEditorId) ?? list.editors[0];

  return {
    editors: list.editors,
    preferredEditorId: list.preferredEditorId,
    menuOpen,
    busy,
    error,
    targetLabel: preferred?.label,
    wrapRef,
    toggleMenu,
    openIn,
  };
}
