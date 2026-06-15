import { useState } from "react";
import { useBrowser } from "../hooks/useBrowser";
import "./BrowserControls.css";

/**
 * BrowserControls — the renderer-owned control + status strip for the REAL
 * embedded Chromium surface.
 *
 * IMPORTANT: the web page itself is rendered by a main-process Electron
 * BrowserView (no Node access, context isolation on). This component does NOT
 * embed remote content — no iframe, no <webview>. It only:
 *   - drives navigation via the local control API (back/forward/reload/home/go)
 *   - shows the TRUTHFUL browser state (url, title, loading, history, errors)
 *
 * The BrowserView is inset from the window, leaving this strip (and the
 * assistant overlay) visible above/beside the live page.
 */
export function BrowserControls(): JSX.Element {
  const browser = useBrowser();
  const [draftUrl, setDraftUrl] = useState("");

  const state = browser.state;
  const currentUrl = state?.currentUrl ?? "";
  const title = state?.title ?? "";
  const loading = state?.loading ?? false;
  const canGoBack = state?.canGoBack ?? false;
  const canGoForward = state?.canGoForward ?? false;
  const lastError = state?.lastError ?? null;

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    const value = draftUrl.trim();
    if (value.length === 0) {
      return;
    }
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    void browser.navigate(normalized);
    setDraftUrl("");
  };

  return (
    <main className="mirror-shell browser-real">
      <section className="browser-controls">
        <header className="browser-controls__head">
          <p className="eyebrow">Browser</p>
          <span
            className={`browser-controls__live${
              loading ? " is-loading" : ""
            }`}
          >
            {loading ? "Loading…" : "Live Chromium surface"}
          </span>
        </header>

        <div className="browser-controls__nav">
          <button
            type="button"
            className="browser-btn"
            disabled={!canGoBack || browser.pending}
            onClick={() => void browser.back()}
            aria-label="Back"
          >
            ←
          </button>
          <button
            type="button"
            className="browser-btn"
            disabled={!canGoForward || browser.pending}
            onClick={() => void browser.forward()}
            aria-label="Forward"
          >
            →
          </button>
          <button
            type="button"
            className="browser-btn"
            disabled={browser.pending}
            onClick={() => void browser.reload()}
            aria-label="Reload"
          >
            ↻
          </button>
          <button
            type="button"
            className="browser-btn"
            disabled={browser.pending}
            onClick={() => void browser.home()}
            aria-label="Home"
          >
            ⌂
          </button>

          <form className="browser-controls__urlform" onSubmit={submit}>
            <input
              type="text"
              className="browser-controls__url"
              placeholder="Enter a URL and press Enter…"
              value={draftUrl}
              onChange={(event) => setDraftUrl(event.target.value)}
              disabled={browser.pending}
            />
          </form>
        </div>

        <div className="browser-controls__status" aria-live="polite">
          {browser.unreachable ? (
            <span className="browser-controls__hint">
              Control API not reachable.
            </span>
          ) : (
            <>
              <span className="browser-controls__title">
                {title || "Untitled"}
              </span>
              <span className="browser-controls__currenturl">
                {currentUrl || state?.homeUrl || "No page loaded"}
              </span>
            </>
          )}
          {lastError ? (
            <span className="browser-controls__error">
              Load error ({lastError.code}): {lastError.message}
            </span>
          ) : null}
        </div>

        <p className="browser-controls__note">
          The page renders in a real embedded Chromium view beside this panel.
          Remote pages run sandboxed with no Node access.
        </p>
      </section>
    </main>
  );
}
