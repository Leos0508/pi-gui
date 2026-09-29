import { useEffect, useRef, useState } from "react";
import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";

/**
 * Prototype: flags registered by loaded extensions, set for the thread about to start.
 * Mirrors the terminal, where a flag belongs to one pi process typed at launch.
 */
export function ExtensionFlagsSelector({
  runtime,
  values,
  onSetFlag,
}: {
  readonly runtime?: RuntimeSnapshot;
  readonly values: Readonly<Record<string, boolean | string>>;
  readonly onSetFlag: (name: string, value: boolean | string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const groups = (runtime?.extensions ?? [])
    .filter((extension) => extension.enabled && (extension.flagDetails?.length ?? 0) > 0)
    .map((extension) => ({
      title: extension.displayName,
      flags: extension.flagDetails ?? [],
    }));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  if (groups.length === 0) return null;
  const setCount = Object.keys(values).length;

  return (
    <span className="model-selector" ref={containerRef}>
      <span className="new-thread__hint-separator">·</span>
      <span className="model-selector__anchor">
        <button
          className="model-selector__badge"
          type="button"
          data-testid="extension-flags-badge"
          onClick={() => setOpen(!open)}
        >
          {setCount > 0 ? `Flags · ${setCount}` : "Flags"}
        </button>
        {open ? (
          <div
            className="model-selector__dropdown model-selector__dropdown--below extension-flags__dropdown"
            data-testid="extension-flags-dropdown"
            onWheel={(event) => event.stopPropagation()}
          >
            {groups.map((group) => (
              <div key={group.title}>
                <div className="model-selector__group-title">{group.title}</div>
                {group.flags.map((flag) => {
                  const value = values[flag.name];
                  return (
                    <label className="model-selector__item extension-flags__item" key={flag.name}>
                      <span className="extension-flags__name">
                        <span className="model-selector__item-label">--{flag.name}</span>
                        {flag.description ? (
                          <span className="model-selector__item-meta">{flag.description}</span>
                        ) : null}
                      </span>
                      {flag.type === "boolean" ? (
                        <input
                          type="checkbox"
                          role="switch"
                          aria-label={`--${flag.name}`}
                          checked={value === true}
                          onChange={(event) => onSetFlag(flag.name, event.target.checked)}
                        />
                      ) : (
                        <input
                          type="text"
                          className="extension-flags__input"
                          aria-label={`--${flag.name}`}
                          placeholder={typeof flag.default === "string" ? flag.default : "value"}
                          value={typeof value === "string" ? value : ""}
                          onChange={(event) => onSetFlag(flag.name, event.target.value)}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}
      </span>
    </span>
  );
}
