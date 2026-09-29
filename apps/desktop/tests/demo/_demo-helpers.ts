import type { Page } from "@playwright/test";

export async function caption(page: Page, step: string, text: string, code?: string) {
  await page.evaluate(
    ({ step, text, code }) => {
      let el = document.getElementById("demo-caption");
      if (!el) {
        el = document.createElement("div");
        el.id = "demo-caption";
        Object.assign(el.style, {
          position: "fixed", top: "12px", left: "50%", transform: "translateX(-50%)",
          zIndex: "99999", background: "#111827", color: "#f9fafb", padding: "10px 18px",
          borderRadius: "10px", font: "600 18px system-ui, sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,.35)",
          pointerEvents: "none", maxWidth: "82vw", textAlign: "center",
        });
        document.body.appendChild(el);
      }
      el.textContent = `${step}  ·  ${text}`;
      let codeEl = document.getElementById("demo-code");
      if (code) {
        if (!codeEl) {
          codeEl = document.createElement("pre");
          codeEl.id = "demo-code";
          Object.assign(codeEl.style, {
            position: "fixed", bottom: "16px", right: "16px", zIndex: "99999",
            background: "#0b1220", color: "#d1e3ff", padding: "12px 16px", margin: "0",
            borderRadius: "10px", font: "500 13px ui-monospace, monospace", lineHeight: "1.45",
            boxShadow: "0 4px 16px rgba(0,0,0,.35)", pointerEvents: "none", maxWidth: "46vw",
            whiteSpace: "pre-wrap",
          });
          document.body.appendChild(codeEl);
        }
        codeEl.textContent = code;
        codeEl.style.display = "block";
      } else if (codeEl) {
        codeEl.style.display = "none";
      }
    },
    { step, text, code: code ?? "" },
  );
}

export async function runCommand(page: Page, command: string) {
  const composer = page.getByTestId("composer");
  await composer.click();
  await composer.fill(command + " ");
  await page.waitForTimeout(900);
  await composer.press("Enter");
}
