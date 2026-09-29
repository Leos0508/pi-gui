import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon } from "../../../ui/icons";
import { ANNOTATION_ROOT_ATTRIBUTE, type OpenAnnotation } from "./annotation-markers";
import { rangeToOffsets } from "./text-offsets";
import type { TranscriptAnnotations } from "./use-transcript-annotations";

interface TranscriptSelection {
  readonly messageId: string;
  readonly start: number;
  readonly end: number;
  readonly quote: string;
  readonly rect: DOMRect;
}

interface OpenEditor {
  readonly id: string;
  readonly anchor: DOMRect;
}

export function addToChatShortcutKeys(platform: NodeJS.Platform): readonly string[] {
  return platform === "darwin" ? ["⌘", "L"] : ["Ctrl", "L"];
}

function isAddToChatShortcut(event: KeyboardEvent, platform: NodeJS.Platform): boolean {
  const modifier = platform === "darwin" ? event.metaKey && !event.ctrlKey : event.ctrlKey;
  return (
    modifier &&
    !event.altKey &&
    !event.shiftKey &&
    (event.key.toLowerCase() === "l" || event.code === "KeyL")
  );
}

/** A non-empty selection inside one message's text in this timeline pane. */
function readTranscriptSelection(pane: HTMLElement): TranscriptSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const element = container instanceof Element ? container : container.parentElement;
  const root = element?.closest(`[${ANNOTATION_ROOT_ATTRIBUTE}]`);
  const messageId = root?.closest<HTMLElement>("[data-message-id]")?.dataset.messageId;
  if (!root || !messageId || !pane.contains(root)) return null;
  const quote = selection.toString().trim();
  if (!quote) return null;
  const { start, end } = rangeToOffsets(root, range);
  return { messageId, start, end, quote, rect: range.getBoundingClientRect() };
}

const POPOVER_GAP = 8;

function popoverTop(anchor: DOMRect, height: number): number {
  const above = anchor.top - height - POPOVER_GAP;
  return above >= POPOVER_GAP ? above : anchor.bottom + POPOVER_GAP;
}

/**
 * The "Add to Chat" button over a transcript selection, and the comment box that opens
 * when an annotation is added or its marker is clicked.
 */
export function useAnnotationSelection({
  paneRef,
  annotations,
  platform,
}: {
  readonly paneRef: { readonly current: HTMLElement | null };
  readonly annotations: TranscriptAnnotations | undefined;
  readonly platform: NodeJS.Platform;
}) {
  const [selection, setSelection] = useState<TranscriptSelection | null>(null);
  const [editor, setEditor] = useState<OpenEditor | null>(null);
  const pointerDownRef = useRef(false);

  const snapEditorToMarker = useCallback(
    () =>
      setEditor((current) => {
        const marker = current
          ? paneRef.current?.querySelector(`[data-annotation-id="${current.id}"]`)
          : null;
        return current && marker ? { ...current, anchor: marker.getBoundingClientRect() } : current;
      }),
    [paneRef],
  );

  useEffect(() => {
    if (!annotations) return undefined;
    const refresh = () => {
      const pane = paneRef.current;
      setSelection(pane && !pointerDownRef.current ? readTranscriptSelection(pane) : null);
    };
    // The comment box follows its marker while the transcript scrolls or streams.
    const followMarker = (event: Event) => {
      refresh();
      if (event.target instanceof Node && paneRef.current?.contains(event.target)) {
        snapEditorToMarker();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(".annotation-popover")) return;
      pointerDownRef.current = true;
      setSelection(null);
    };
    const onPointerUp = () => {
      pointerDownRef.current = false;
      // The selection settles after pointerup.
      requestAnimationFrame(refresh);
    };
    document.addEventListener("selectionchange", refresh);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("scroll", followMarker, true);
    return () => {
      document.removeEventListener("selectionchange", refresh);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("scroll", followMarker, true);
    };
  }, [annotations, paneRef, snapEditorToMarker]);

  const addSelection = useCallback(() => {
    if (!annotations || !selection) return;
    const id = annotations.add({
      messageId: selection.messageId,
      start: selection.start,
      end: selection.end,
      quote: selection.quote,
    });
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setEditor({ id, anchor: selection.rect });
  }, [annotations, selection]);

  useEffect(() => {
    if (!selection) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isAddToChatShortcut(event, platform) || event.repeat) return;
      event.preventDefault();
      addSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addSelection, platform, selection]);

  // A new annotation's marker is placed a frame after the add; the box then sits above it.
  const editorId = editor?.id;
  useEffect(() => {
    if (!editorId) return undefined;
    const frame = requestAnimationFrame(snapEditorToMarker);
    return () => cancelAnimationFrame(frame);
  }, [editorId, snapEditorToMarker]);

  const openAnnotation: OpenAnnotation = useCallback((id, anchor) => {
    setSelection(null);
    setEditor({ id, anchor });
  }, []);

  const editing = editor ? annotations?.list.find((entry) => entry.id === editor.id) : undefined;
  const layer = (
    <>
      {selection && !editor ? (
        <AddToChatButton anchor={selection.rect} platform={platform} onAdd={addSelection} />
      ) : null}
      {editor && editing && annotations ? (
        <AnnotationEditor
          anchor={editor.anchor}
          key={editor.id}
          note={editing.note}
          onClose={() => setEditor(null)}
          onRemove={() => {
            annotations.remove(editor.id);
            setEditor(null);
          }}
          onSave={(note) => annotations.setNote(editor.id, note)}
        />
      ) : null}
    </>
  );
  return { layer, openAnnotation };
}

function AddToChatButton({
  anchor,
  platform,
  onAdd,
}: {
  readonly anchor: DOMRect;
  readonly platform: NodeJS.Platform;
  readonly onAdd: () => void;
}) {
  return (
    <div
      className="annotation-popover annotation-add"
      style={{ top: popoverTop(anchor, 32), left: Math.max(POPOVER_GAP, anchor.left) }}
    >
      <button
        className="annotation-add__button"
        data-testid="add-to-chat"
        type="button"
        // Keep the transcript selection alive through the click.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onAdd}
      >
        <span>Add to Chat</span>
        <span className="annotation-add__keys" aria-hidden="true">
          {addToChatShortcutKeys(platform).map((key) => (
            <kbd key={key}>{key}</kbd>
          ))}
        </span>
      </button>
    </div>
  );
}

function AnnotationEditor({
  anchor,
  note,
  onSave,
  onRemove,
  onClose,
}: {
  readonly anchor: DOMRect;
  readonly note: string;
  readonly onSave: (note: string) => void;
  readonly onRemove: () => void;
  readonly onClose: () => void;
}) {
  const [value, setValue] = useState(note);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closingRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const finish = (save: boolean) => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (save) onSave(value.trim());
    onClose();
  };

  return (
    <div
      className="annotation-popover annotation-editor"
      data-testid="annotation-editor"
      style={{ top: popoverTop(anchor, 44), left: Math.max(POPOVER_GAP, anchor.left - 24) }}
    >
      <input
        aria-label="Annotation comment"
        className="annotation-editor__input"
        placeholder="Add an optional comment…"
        ref={inputRef}
        value={value}
        onBlur={() => finish(true)}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            finish(true);
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            finish(false);
          }
        }}
      />
      <button
        aria-label="Remove annotation"
        className="annotation-editor__remove"
        data-testid="annotation-remove"
        title="Remove annotation"
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          closingRef.current = true;
          onRemove();
        }}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
