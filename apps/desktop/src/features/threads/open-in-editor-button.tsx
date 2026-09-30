import { CheckIcon, ChevronDownIcon, OpenInEditorIcon } from "../../ui/icons";
import type { OpenInEditorState } from "./hooks/use-open-in-editor";

interface OpenInEditorButtonProps {
  readonly state: OpenInEditorState;
  readonly onOpenFolder: () => void;
}

export function OpenInEditorButton({ state, onOpenFolder }: OpenInEditorButtonProps) {
  const label = state.targetLabel
    ? `Open in ${state.targetLabel}`
    : "Open this project in an editor";

  return (
    <div className="open-in-editor" ref={state.wrapRef}>
      <button
        aria-label={label}
        className="open-in-editor__main"
        data-testid="open-in-editor"
        disabled={state.busy}
        title={label}
        type="button"
        onClick={() => state.openIn()}
      >
        <OpenInEditorIcon />
      </button>
      <button
        aria-expanded={state.menuOpen}
        aria-haspopup="menu"
        aria-label="Choose editor"
        className="open-in-editor__trigger"
        data-testid="open-in-editor-menu-trigger"
        title="Choose editor"
        type="button"
        onClick={state.toggleMenu}
      >
        <ChevronDownIcon />
      </button>
      {state.menuOpen ? (
        <div className="open-in-editor__menu" data-testid="open-in-editor-menu" role="menu">
          {state.editors.length === 0 ? (
            <p className="open-in-editor__empty">No supported editor found on this computer.</p>
          ) : (
            state.editors.map((editor) => (
              <button
                key={editor.id}
                className="open-in-editor__item"
                data-testid={`open-in-editor-${editor.id}`}
                role="menuitem"
                type="button"
                onClick={() => state.openIn(editor.id)}
              >
                <span className="open-in-editor__item-label">{editor.label}</span>
                {editor.id === state.preferredEditorId ? (
                  <span className="open-in-editor__item-check">
                    <CheckIcon />
                  </span>
                ) : null}
              </button>
            ))
          )}
          {state.editors.length === 0 ? (
            <button
              className="open-in-editor__item"
              data-testid="open-in-editor-folder"
              role="menuitem"
              type="button"
              onClick={() => {
                state.toggleMenu();
                onOpenFolder();
              }}
            >
              <span className="open-in-editor__item-label">Open folder</span>
            </button>
          ) : null}
          {state.error ? <p className="open-in-editor__error">{state.error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
